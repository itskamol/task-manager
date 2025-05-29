import { execSync } from 'child_process';
import Redis from 'ioredis'; // For direct Redis connection if needed, and Bull uses it
import Bull from 'bull';      // For Bull queue operations
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') }); // Path relative to test/config/globalSetup.ts

export default async () => {
  console.log('\nRunning global E2E setup...');

  // 1. Run Prisma migrations
  try {
    console.log('Applying Prisma migrations for test database...');
    // Assuming schema.prisma is in prisma/ relative to project root
    execSync('npx prisma migrate deploy --schema=./prisma/schema.prisma', {
      stdio: 'inherit',
      env: { ...process.env }, // Ensure CLI has access to DB URL from .env.test
    });
    console.log('Prisma migrations applied successfully.');
  } catch (error) {
    console.error('🔴 Failed to apply Prisma migrations:', error);
    process.exit(1);
  }

  // 2. Clean Bull queues
  const redisHost = process.env.REDIS_HOST;
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD || undefined; // Handle optional password

  if (redisHost && redisPort) {
    const redisConnectionOpts = {
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    };
    const redis = new Redis(redisConnectionOpts); // For direct check or other operations

    redis.on('error', (err) => {
      console.warn('Redis connection error during setup (direct connection):', err.message);
      // Not exiting here, Bull queue cleaning might still work if it establishes its own connection
    });

    try {
      await redis.ping(); // Check direct connection
      console.log('Successfully connected to test Redis (direct connection).');
      
      // Assuming 'reminders' is a queue name. Add other queue names if they exist.
      const queueNames = ['reminders']; // Add other queue names here if needed

      for (const queueName of queueNames) {
        console.log(`Attempting to clean queue: ${queueName}...`);
        // Bull's Redis connection options are slightly different if specified directly
        const bullQueue = new Bull(queueName, { redis: redisConnectionOpts });
        
        bullQueue.on('error', (error) => {
          console.warn(`Error with Bull queue "${queueName}" during setup:`, error.message);
        });

        await bullQueue.clean(0, 'wait');
        await bullQueue.clean(0, 'active');
        await bullQueue.clean(0, 'completed');
        await bullQueue.clean(0, 'failed');
        await bullQueue.clean(0, 'delayed');
        console.log(`✅ Queue ${queueName} cleaned.`);
        await bullQueue.close();
      }
      console.log('All specified Bull queues cleaned.');
    } catch (error) {
      console.error('🔴 Failed to clean Bull queues or connect to Redis:', error);
      // Depending on test requirements, you might want to process.exit(1) here
    } finally {
        if (redis.status === 'ready' || redis.status === 'connecting') {
            await redis.quit();
            console.log('Direct Redis connection closed.');
        }
    }
  } else {
    console.warn('⚠️ Redis configuration (REDIS_HOST, REDIS_PORT) not found in .env.test, skipping Bull queue cleaning.');
  }
  console.log('\nGlobal E2E setup complete.\n');
};

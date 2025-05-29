import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.test, if needed for teardown logic
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

export default async () => {
  console.log('\nRunning global E2E teardown...');

  // Example: Disconnect from any global resources if they were established in globalSetup
  // and not cleaned up there.
  // For instance, if a global database connection pool specific to tests was created:
  // await globalTestDbPool.end();
  // console.log('Global test database pool disconnected.');

  // If Redis connection was kept global and open from setup:
  // await globalRedisClient.quit();
  // console.log('Global Redis client disconnected.');
  
  // Prisma client connections are generally managed by PrismaClient instances and
  // don't require explicit global teardown unless a global instance was managed.

  // Bull queue connections made in globalSetup were closed there.

  console.log('\nGlobal E2E teardown complete.\n');
};

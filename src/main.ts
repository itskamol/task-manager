import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './config/logger.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const logger = WinstonModule.createLogger(loggerConfig);

  const app = await NestFactory.create(AppModule, {
    logger,
    bufferLogs: true,
  });

  // Apply global error filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Task Manager API')
    .setDescription('API docs for the task manager backend')
    .setVersion('1.0')
    .addBearerAuth() // Optional: if you plan to use JWT Bearer auth for APIs
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Swagger API documentation available at ${await app.getUrl()}/api`);

  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, starting graceful shutdown...`);
      await app.close();
      logger.log('Application terminated');
      process.exit(0);
    });
  });
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});

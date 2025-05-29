import { Module } from '@nestjs/common';
import { BotModule } from './bot/bot.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { envSchema } from './config/env.config';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './config/logger.config';
import { LoggerModule } from './common/services/logger.module';
import { TasksModule } from './tasks/tasks.module';
import { ReportsModule } from './reports/reports.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AiModule } from './ai/ai.module';
import { BotLoggerModule } from './bot/bot-logger.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            validate: (config) => envSchema.parse(config),
            isGlobal: true,
        }),
        WinstonModule.forRoot(loggerConfig),
        LoggerModule,
        BotLoggerModule,
        PrismaModule,
        BotModule,
        TasksModule,
        ReportsModule,
        SchedulerModule,
        AiModule,
    ],
})
export class AppModule {}

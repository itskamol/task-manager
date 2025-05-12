import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SchedulerService } from './scheduler.service';
import { ReminderProcessor } from './processors/reminder.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                redis: {
                    host: configService.get('REDIS_HOST', 'localhost'),
                    port: configService.get('REDIS_PORT', 6379),
                },
            }),
            inject: [ConfigService],
        }),
        BullModule.registerQueue({
            name: 'reminders',
        }),
    ],
    providers: [SchedulerService, ReminderProcessor],
    exports: [SchedulerService],
})
export class SchedulerModule {}

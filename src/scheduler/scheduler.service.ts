import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { LoggerService } from '../common/services/logger.service';

interface ReminderData {
    taskId: string;
    userId: string;
    title: string;
    description?: string;
}

@Injectable()
export class SchedulerService {
    constructor(
        @InjectQueue('reminders') private readonly reminderQueue: Queue,
        private readonly logger: LoggerService,
    ) {}

    async scheduleReminder(remindAt: Date, data: ReminderData): Promise<void> {
        try {
            const delay = remindAt.getTime() - Date.now();
            if (delay <= 0) {
                this.logger.warn('Attempted to schedule reminder in the past', {
                    taskId: data.taskId,
                    remindAt,
                });
                return;
            }

            await this.reminderQueue.add('sendReminder', data, {
                delay,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            });

            this.logger.info('Reminder scheduled', {
                taskId: data.taskId,
                remindAt,
            });
        } catch (error) {
            this.logger.error('Failed to schedule reminder', error, {
                taskId: data.taskId,
            });
            throw error;
        }
    }

    async cancelReminder(taskId: string): Promise<void> {
        try {
            const jobs = await this.reminderQueue.getJobs(['waiting', 'delayed']);
            const reminderJob = jobs.find((job) => job.data.taskId === taskId);

            if (reminderJob) {
                await reminderJob.remove();
                this.logger.info('Reminder cancelled', { taskId });
            }
        } catch (error) {
            this.logger.error('Failed to cancel reminder', error, { taskId });
            throw error;
        }
    }
}

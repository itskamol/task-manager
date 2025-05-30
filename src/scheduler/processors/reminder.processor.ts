import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { LoggerService } from '../../common/services/logger.service';
import { Bot } from 'grammy';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Status } from '@prisma/client';

interface ReminderData {
    taskId: string;
    userId: string;
    reminderId?: string;
}

@Processor('reminders')
export class ReminderProcessor {
    private readonly bot: Bot;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService,
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        if (!token) {
            throw new Error('TELEGRAM_BOT_TOKEN is not defined');
        }
        this.bot = new Bot(token);
    }

    @Process('sendReminder')
    async handleReminder(job: Job<ReminderData>): Promise<void> {
        const { taskId, userId, reminderId } = job.data;

        try {
            // Check if task still exists
            const task = await this.prisma.task.findUnique({
                where: { id: taskId },
                include: {
                    user: true,
                },
            });

            if (!task) {
                this.logger.warn(`Task not found for reminder: ${taskId}`);
                return;
            }

            if (task.status === Status.DONE) {
                this.logger.log(`Task already completed, skipping reminder: ${taskId}`);
                return;
            }

            const user = task.user;
            if (!user) {
                this.logger.warn(`User not found for task: ${taskId}`);
                return;
            }

            // Create reminder message
            const priorityEmoji = {
                HIGH: '🔥',
                MEDIUM: '🟡',
                LOW: '🟢',
            };

            const emoji = priorityEmoji[task.priority] || '📝';
            const deadlineText = task.deadline
                ? `\n📅 Muddat: ${new Date(task.deadline).toLocaleDateString('uz-UZ')}`
                : '';

            const message = `⏰ **Eslatma!**\n\n${emoji} ${task.title}${deadlineText}\n\n💡 Vazifani bajarish vaqti keldi!\n\n/done_${task.id} tugmasini bosing bajarilgach.`;

            try {
                // Send reminder to Telegram
                await this.bot.api.sendMessage(user.telegramId.toString(), message);
                this.logger.log(`Reminder sent successfully for task: ${taskId}`);
            } catch (telegramError) {
                this.logger.error(
                    `Failed to send Telegram message for task: ${taskId}`,
                    telegramError,
                );
                return;
            }

            // Update reminder record if exists
            if (reminderId) {
                try {
                    await this.prisma.reminder.update({
                        where: { id: reminderId },
                        data: { isSent: true },
                    });
                    this.logger.log(`Reminder record updated for task: ${taskId}`);
                } catch (updateError) {
                    this.logger.error(
                        `Failed to update reminder record: ${reminderId}`,
                        updateError,
                    );
                    // Don't throw error as message was sent successfully
                }
            } else {
                // Try to find and update any pending reminder for this task
                try {
                    const pendingReminder = await this.prisma.reminder.findFirst({
                        where: {
                            taskId: taskId,
                            isSent: false,
                        },
                    });

                    if (pendingReminder) {
                        await this.prisma.reminder.update({
                            where: { id: pendingReminder.id },
                            data: { isSent: true },
                        });
                    }
                } catch (findError) {
                    this.logger.error(
                        `Error handling reminder record for task: ${taskId}`,
                        findError,
                    );
                }
            }
        } catch (error) {
            this.logger.error('Failed to process reminder', error, {
                taskId,
                userId,
            });
            throw error;
        }
    }

    async cleanupOrphanedReminders(): Promise<void> {
        try {
            // Find reminders for tasks that no longer exist using a raw query approach
            const allReminders = await this.prisma.reminder.findMany({
                include: {
                    task: true,
                },
            });

            const orphanedReminders = allReminders.filter((r) => !r.task);

            if (orphanedReminders.length > 0) {
                await this.prisma.reminder.deleteMany({
                    where: {
                        id: {
                            in: orphanedReminders.map((r) => r.id),
                        },
                    },
                });

                this.logger.info(`Cleaned up ${orphanedReminders.length} orphaned reminders`);
            }
        } catch (error) {
            this.logger.error('Failed to cleanup orphaned reminders', error);
        }
    }
}

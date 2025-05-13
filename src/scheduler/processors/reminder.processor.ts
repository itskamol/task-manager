import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { LoggerService } from '../../common/services/logger.service';
import { Bot } from 'grammy';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface ReminderData {
    taskId: string;
    userId: string;
    title: string;
    description?: string;
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
        const { taskId, userId, title, description } = job.data;

        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                throw new Error(`User not found: ${userId}`);
            }

            const message = [
                '⏰ Reminder!',
                `Task: ${title}`,
                description && `Details: ${description}`,
                '\nReply with /done to mark as completed',
            ]
                .filter(Boolean)
                .join('\n');

            await this.bot.api.sendMessage(user.telegramId.toString(), message);

            // Update reminder as sent
            await this.prisma.reminder.update({
                where: { id: taskId },
                data: { isSent: true },
            });

            this.logger.info('Reminder sent successfully', {
                taskId,
                userId: user.telegramId,
            });
        } catch (error) {
            this.logger.error('Failed to send reminder', error, {
                taskId,
                userId,
            });
            throw error;
        }
    }
}

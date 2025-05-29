import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { TasksService } from '../tasks.service';
import { Priority, Status } from '@prisma/client';
import { formatInUserTz } from '../utils/time.utils';
import { BotLoggerService } from '../../bot/services/bot-logger.service';
import { AiService } from '../../ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TasksHandler {
    constructor(
        private readonly tasksService: TasksService,
        private readonly logger: BotLoggerService,
        private readonly prisma: PrismaService, // Keep PrismaService for direct user access
        private readonly aiService: AiService, // Keep AiService for handleListTasks
    ) {}

    async handleAddTask(ctx: Context): Promise<void> {
        if (!ctx.from?.id || !ctx.message?.text) return;

        const taskText = ctx.message.text.split(' ').slice(1).join(' ');
        if (!taskText) {
            await ctx.reply('Please provide a task title. Example: /add Buy groceries');
            return;
        }

        try {
            // Get user from database directly
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply('Please register first using /start command.');
                return;
            }

            const task = await this.tasksService.createTaskWithAISuggestions(
                user.id,
                taskText,
                user.timezone,
            );

            const formattedDeadline = formatInUserTz(task.deadline, user.timezone);
            const deadlineText = formattedDeadline
                ? `\nDeadline: ${formattedDeadline} (${user.timezone})`
                : '';
            const estimatedTimeText = task.estimatedTime
                ? `\nEstimated time: ${task.estimatedTime} minutes`
                : '';

            await ctx.reply(
                `✅ Task created: ${task.title}\n` +
                    `Priority: ${this.getPriorityEmoji(task.priority)} ${task.priority}` +
                    deadlineText +
                    estimatedTimeText +
                    '\n\nUse /set_deadline or /set_priority to adjust these suggestions.',
            );

            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply('Sorry, failed to create task. Please try again.');
        }
    }

    async handleListTasks(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            // Get user from database directly
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply("Iltimos, avval /start buyrug'i orqali ro'yxatdan o'ting.");
                return;
            }

            const tasks = await this.tasksService.getUserTasks(user.id);

            if (tasks.length === 0) {
                await ctx.reply('You have no tasks. Use /add to create one!');
                return;
            }

            // Use AI to optimize task order
            const optimizedTasks = await this.aiService.optimizeSchedule(tasks);

            const userTimezone = user.timezone;

            const taskList = optimizedTasks
                .map((task) => {
                    const status = task.status === Status.DONE ? '✅' : '⏳';
                    const priority = this.getPriorityEmoji(task.priority);
                    const deadline = formatInUserTz(task.deadline, userTimezone);
                    const deadlineText = deadline
                        ? `\nDeadline: ${deadline} (${userTimezone})`
                        : '';
                    const estimatedTime = task.estimatedTime
                        ? `\nEstimated: ${task.estimatedTime} minutes`
                        : '';

                    return `${status} ${priority} ${task.title}${deadlineText}${estimatedTime}`;
                })
                .join('\n\n');

            await ctx.reply(
                '📋 Your tasks (optimized by priority and deadline):\n\n' +
                    taskList +
                    '\n\nUse /add to create a new task.',
            );

            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply('Sorry, failed to list tasks. Please try again.');
        }
    }

    private getPriorityEmoji(priority: Priority): string {
        switch (priority) {
            case Priority.HIGH:
                return '🔴';
            case Priority.MEDIUM:
                return '🟡';
            case Priority.LOW:
                return '🟢';
            default:
                return '⚪️';
        }
    }
}

import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { TasksService } from '../tasks.service';
import { BotLoggerService } from '../../bot/bot-logger.service';
import { Priority, Repeat, Status } from '@prisma/client';
import { AiService } from '../../ai/ai.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { formatInUserTz } from '../utils/time.utils';

@Injectable()
export class TasksHandler {
    constructor(
        private readonly tasksService: TasksService,
        private readonly logger: BotLoggerService,
        private readonly aiService: AiService,
        private readonly prisma: PrismaService,
    ) {}

    async handleAddTask(ctx: Context): Promise<void> {
        if (!ctx.from?.id || !ctx.message?.text) return;

        const args = ctx.message.text.split(' ').slice(1).join(' ');
        if (!args) {
            await ctx.reply('Please provide a task title. Example: /add Buy groceries');
            return;
        }

        try {
            // Use AI to analyze and suggest task properties
            const priority = this.aiService.analyzePriority(args);
            const estimatedTime = this.aiService.estimateTaskDuration(args);

            // Get user timezone from the database
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            const timezone = user?.timezone || 'Asia/Tashkent';

            const taskDto: CreateTaskDto = {
                title: args,
                priority,
                estimatedTime: estimatedTime ?? undefined,
                timezone,
            };

            // Convert deadline to Date if it exists
            if (taskDto.deadline) {
                taskDto.deadline = new Date(taskDto.deadline).toISOString();
            }

            const task = await this.tasksService.createTask(user?.id || '', {
                ...taskDto,
                deadline: taskDto.deadline ? new Date(taskDto.deadline) : undefined,
            });

            // Get AI-suggested deadline
            const suggestedDeadline = this.aiService.suggestDeadline(task);
            if (suggestedDeadline) {
                const updatedTask = await this.tasksService.updateTask(task.id, user?.id || '', {
                    deadline: suggestedDeadline,
                });
                task.deadline = updatedTask.deadline;
            }

            const formattedDeadline = formatInUserTz(task.deadline, timezone);
            const deadlineText = formattedDeadline
                ? `\nDeadline: ${formattedDeadline} (${timezone})`
                : '';
            const estimatedTimeText = estimatedTime
                ? `\nEstimated time: ${estimatedTime} minutes`
                : '';

            await ctx.reply(
                `✅ Task created: ${task.title}\n` +
                    `Priority: ${this.getPriorityEmoji(priority)} ${priority}` +
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
            const tasks = await this.tasksService.getUserTasks(String(ctx.from.id));

            if (tasks.length === 0) {
                await ctx.reply('You have no tasks. Use /add to create one!');
                return;
            }

            // Use AI to optimize task order
            const optimizedTasks = await this.aiService.optimizeSchedule(tasks);

            // Get user timezone
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });
            const timezone = user?.timezone || 'Asia/Tashkent';

            const taskList = optimizedTasks
                .map((task) => {
                    const status = task.status === Status.DONE ? '✅' : '⏳';
                    const priority = this.getPriorityEmoji(task.priority);
                    const deadline = formatInUserTz(task.deadline, timezone);
                    const deadlineText = deadline ? `\nDeadline: ${deadline} (${timezone})` : '';
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

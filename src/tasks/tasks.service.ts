import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Task, Priority, Status, Repeat } from '@prisma/client';
import { SchedulerService } from '../scheduler/scheduler.service';
import { AiService } from '../ai/ai.service'; // Import AiService

@Injectable()
export class TasksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly scheduler: SchedulerService,
        private readonly aiService: AiService, // Inject AiService
    ) {}

    async createTaskWithAISuggestions(
        userId: string,
        taskText: string,
        userTimezone: string, // Already part of task model, but good for context
    ): Promise<Task> {
        // 1. Get AI suggestions for priority and estimated time
        const priority = await this.aiService.analyzePriority(taskText);
        const estimatedTime = await this.aiService.estimateTaskDuration(taskText);

        // 2. Create the initial task
        let task = await this.createTask(userId, {
            title: taskText,
            priority,
            estimatedTime: estimatedTime ?? undefined,
            // The userTimezone is primarily for display or deadline interpretation,
            // the task.timezone field in Prisma schema has a default.
            // We can set it here if needed, or rely on default/update later.
            // For now, let's assume `createTask` handles the timezone if it's part of its 'data' param.
            // If task model's timezone should be user's timezone, pass it here.
            timezone: userTimezone, // Assuming task.timezone should be user's timezone
        });

        // 3. Get AI-suggested deadline for the created task
        const suggestedDeadline = await this.aiService.suggestDeadline(task);

        // 4. If a deadline is suggested, update the task
        if (suggestedDeadline) {
            task = await this.updateTask(task.id, userId, {
                deadline: suggestedDeadline,
            });
        }

        return task;
    }

    async createTask(
        userId: string,
        data: {
            title: string;
            description?: string;
            priority?: Priority;
            deadline?: Date;
            repeat?: Repeat;
            estimatedTime?: number;
            timezone?: string; // Add timezone property
        },
    ): Promise<Task> {
        const task = await this.prisma.task.create({
            data: {
                userId,
                ...data,
            },
        });

        // Schedule reminder if deadline is set
        if (task.deadline) {
            await this.scheduler.scheduleReminder(task.deadline, {
                taskId: task.id,
                userId: task.userId,
                title: task.title,
                description: task.description ?? undefined,
            });
        }

        return task;
    }

    async getUserTasks(userId: string): Promise<Task[]> {
        return this.prisma.task.findMany({
            where: { userId },
            orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
        });
    }

    async updateTask(taskId: string, userId: string, data: Partial<Task>): Promise<Task> {
        const task = await this.prisma.task.update({
            where: {
                id: taskId,
                userId, // Ensure the task belongs to the user
            },
            data,
        });

        // Update reminder if deadline changed
        if ('deadline' in data) {
            // Cancel existing reminder
            await this.scheduler.cancelReminder(taskId);

            // Schedule new reminder if deadline is set
            if (data.deadline) {
                await this.scheduler.scheduleReminder(data.deadline, {
                    taskId: task.id,
                    userId: task.userId,
                    title: task.title,
                    description: task.description ?? undefined,
                });
            }
        }

        return task;
    }

    async deleteTask(taskId: string, userId: string): Promise<Task> {
        // Cancel any scheduled reminders first
        await this.scheduler.cancelReminder(taskId);

        return this.prisma.task.delete({
            where: {
                id: taskId,
                userId, // Ensure the task belongs to the user
            },
        });
    }

    async getUpcomingTasks(userId: string): Promise<Task[]> {
        const now = new Date();
        return this.prisma.task.findMany({
            where: {
                userId,
                status: Status.PENDING,
                deadline: {
                    gte: now,
                },
            },
            orderBy: {
                deadline: 'asc',
            },
        });
    }
}

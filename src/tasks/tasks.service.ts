import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Task, Priority, Status, Repeat } from '@prisma/client';
import { SchedulerService } from '../scheduler/scheduler.service';

@Injectable()
export class TasksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly scheduler: SchedulerService,
    ) {}

    async createTask(
        userId: string,
        data: {
            title: string;
            description?: string;
            priority?: Priority;
            deadline?: Date;
            repeat?: Repeat;
            estimatedTime?: number;
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

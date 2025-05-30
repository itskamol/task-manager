import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Task, Priority, Status, Repeat } from '@prisma/client';
import { SchedulerService } from '../scheduler/scheduler.service';
import { AiService } from '../ai/ai.service';
import { LoggerService } from '../common/services/logger.service';

@Injectable()
export class TasksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly scheduler: SchedulerService,
        private readonly aiService: AiService,
        private readonly logger: LoggerService,
    ) {}

    async createTaskWithAISuggestions(
        userId: string,
        taskText: string,
        userTimezone: string,
    ): Promise<Task> {
        this.logger.debug('Analyzing task with AI', { userId, taskText });

        // 1. Get AI suggestions for priority and estimated time
        const priority = await this.aiService.analyzePriority(taskText);
        const estimatedTime = await this.aiService.estimateTaskDuration(taskText);

        // 2. Create the initial task
        let task = await this.createTask(userId, {
            title: taskText,
            priority,
            estimatedTime: estimatedTime ?? undefined,
            timezone: userTimezone,
        });

        // 3. Get AI-suggested deadline for the created task
        const suggestedDeadline = await this.aiService.suggestDeadline(task);

        // 4. If a deadline is suggested, update the task
        if (suggestedDeadline) {
            task = await this.updateTask(task.id, userId, {
                deadline: suggestedDeadline,
            });
            this.logger.debug('Task deadline updated', {
                taskId: task.id,
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
            timezone?: string;
        },
    ): Promise<Task> {
        try {
            const task = await this.prisma.task.create({
                data: {
                    userId,
                    ...data,
                },
            });

            this.logger.info('Task created', {
                taskId: task.id,
                userId,
                hasDeadline: !!task.deadline,
            });

            // Schedule reminder if deadline is set
            if (task.deadline) {
                await this.scheduler.scheduleReminder(task.deadline, {
                    taskId: task.id,
                    userId: task.userId,
                    title: task.title,
                    description: task.description ?? undefined,
                });
                this.logger.debug('Reminder scheduled', {
                    taskId: task.id,
                    deadline: task.deadline,
                });
            }

            return task;
        } catch (error) {
            this.logger.error('Failed to create task', error, { context: 'TasksService', userId });
            throw error;
        }
    }

    async getUserTasks(userId: string): Promise<Task[]> {
        try {
            const tasks = await this.prisma.task.findMany({
                where: { userId },
                orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
            });

            this.logger.debug('Retrieved user tasks', { userId, count: tasks.length });
            return tasks;
        } catch (error) {
            this.logger.error('Failed to retrieve user tasks', error, {
                context: 'TasksService',
                userId,
            });
            throw error;
        }
    }

    async updateTask(taskId: string, userId: string, data: Partial<Task>): Promise<Task> {
        try {
            const task = await this.prisma.task.update({
                where: {
                    id: taskId,
                    userId,
                },
                data,
            });

            this.logger.info('Task updated', {
                taskId,
                userId,
                updatedFields: Object.keys(data),
            });

            // Update reminder if deadline changed
            if ('deadline' in data) {
                await this.scheduler.cancelReminder(taskId);
                if (data.deadline) {
                    await this.scheduler.scheduleReminder(data.deadline, {
                        taskId: task.id,
                        userId: task.userId,
                        title: task.title,
                        description: task.description ?? undefined,
                    });
                    this.logger.debug('Task reminder rescheduled', {
                        taskId,
                        deadline: data.deadline,
                    });
                }
            }

            return task;
        } catch (error) {
            this.logger.error('Failed to update task', error, {
                context: 'TasksService',
                taskId,
                userId,
                updateData: Object.keys(data),
            });
            throw error;
        }
    }

    async deleteTask(taskId: string, userId: string): Promise<Task> {
        try {
            await this.scheduler.cancelReminder(taskId);
            const task = await this.prisma.task.delete({
                where: {
                    id: taskId,
                    userId,
                },
            });

            this.logger.info('Task deleted', { taskId, userId });
            return task;
        } catch (error) {
            this.logger.error('Failed to delete task', error, {
                context: 'TasksService',
                taskId,
                userId,
            });
            throw error;
        }
    }

    async getUpcomingTasks(userId: string): Promise<Task[]> {
        try {
            const now = new Date();
            const tasks = await this.prisma.task.findMany({
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

            this.logger.debug('Retrieved upcoming tasks', {
                userId,
                count: tasks.length,
                nearestDeadline: tasks.length > 0 ? tasks[0].deadline : null,
            });

            return tasks;
        } catch (error) {
            this.logger.error('Failed to retrieve upcoming tasks', error, {
                context: 'TasksService',
                userId,
            });
            throw error;
        }
    }
}

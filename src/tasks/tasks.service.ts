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
        private readonly aiService: AiService, // Inject AiService
        private readonly logger: LoggerService, // Inject LoggerService
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
            console.log(`Task ${task.id} deadline updated to ${suggestedDeadline}`);
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
        const startTime = Date.now();
        
        try {
            const task = await this.prisma.task.create({
                data: {
                    userId,
                    ...data,
                },
            });

            const duration = Date.now() - startTime;

            // Log successful task creation
            this.logger.logUserAction('TASK_CREATED', userId, {
                taskId: task.id,
                title: task.title.substring(0, 50),
                priority: task.priority,
                hasDeadline: !!task.deadline,
                estimatedTime: task.estimatedTime
            });

            this.logger.logDatabaseOperation('CREATE', 'task', duration, true);

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
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.logger.logDatabaseOperation('CREATE', 'task', duration, false);
            this.logger.error('Failed to create task', error, { context: 'TasksService', userId });
            throw error;
        }
    }

    async getUserTasks(userId: string): Promise<Task[]> {
        const startTime = Date.now();
        
        try {
            const tasks = await this.prisma.task.findMany({
                where: { userId },
                orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
            });

            const duration = Date.now() - startTime;
            this.logger.logDatabaseOperation('READ', 'task', duration, true);
            
            this.logger.logUserAction('TASKS_RETRIEVED', userId, {
                taskCount: tasks.length,
                hasOverdueTasks: tasks.some(task => task.deadline && task.deadline < new Date())
            });

            return tasks;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.logDatabaseOperation('READ', 'task', duration, false);
            this.logger.error('Failed to retrieve user tasks', error, { context: 'TasksService', userId });
            throw error;
        }
    }

    async updateTask(taskId: string, userId: string, data: Partial<Task>): Promise<Task> {
        const startTime = Date.now();
        
        try {
            const task = await this.prisma.task.update({
                where: {
                    id: taskId,
                    userId, // Ensure the task belongs to the user
                },
                data,
            });

            const duration = Date.now() - startTime;
            this.logger.logDatabaseOperation('UPDATE', 'task', duration, true);

            // Log the task update
            this.logger.logUserAction('TASK_UPDATED', userId, {
                taskId: task.id,
                updatedFields: Object.keys(data),
                priority: task.priority,
                status: task.status
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

                    this.logger.logBusinessEvent({
                        event: 'REMINDER_SCHEDULED',
                        data: {
                            taskId: task.id,
                            userId: task.userId,
                            deadline: data.deadline
                        },
                        userId: task.userId,
                        context: 'TasksService'
                    });
                }
            }

            return task;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.logDatabaseOperation('UPDATE', 'task', duration, false);
            this.logger.error('Failed to update task', error, { 
                context: 'TasksService', 
                taskId, 
                userId,
                updateData: Object.keys(data)
            });
            throw error;
        }
    }

    async deleteTask(taskId: string, userId: string): Promise<Task> {
        const startTime = Date.now();
        
        try {
            // Cancel any scheduled reminders first
            await this.scheduler.cancelReminder(taskId);

            const task = await this.prisma.task.delete({
                where: {
                    id: taskId,
                    userId, // Ensure the task belongs to the user
                },
            });

            const duration = Date.now() - startTime;
            this.logger.logDatabaseOperation('DELETE', 'task', duration, true);

            this.logger.logUserAction('TASK_DELETED', userId, {
                taskId: task.id,
                title: task.title.substring(0, 50),
                priority: task.priority,
                wasCompleted: task.status === Status.DONE
            });

            this.logger.logBusinessEvent({
                event: 'REMINDER_CANCELLED',
                data: {
                    taskId: task.id,
                    userId: task.userId,
                    reason: 'TASK_DELETED'
                },
                userId: task.userId,
                context: 'TasksService'
            });

            return task;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.logDatabaseOperation('DELETE', 'task', duration, false);
            this.logger.error('Failed to delete task', error, { 
                context: 'TasksService', 
                taskId, 
                userId 
            });
            throw error;
        }
    }

    async getUpcomingTasks(userId: string): Promise<Task[]> {
        const startTime = Date.now();
        
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

            const duration = Date.now() - startTime;
            this.logger.logDatabaseOperation('READ', 'task', duration, true);

            this.logger.logUserAction('UPCOMING_TASKS_RETRIEVED', userId, {
                upcomingTaskCount: tasks.length,
                nearestDeadline: tasks.length > 0 ? tasks[0].deadline : null
            });

            return tasks;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.logDatabaseOperation('READ', 'task', duration, false);
            this.logger.error('Failed to retrieve upcoming tasks', error, { 
                context: 'TasksService', 
                userId 
            });
            throw error;
        }
    }
}

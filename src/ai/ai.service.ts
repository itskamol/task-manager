import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/services/logger.service';
import { Priority, Task } from '@prisma/client';

@Injectable()
export class AiService {
    constructor(private readonly logger: LoggerService) {}

    analyzePriority(title: string, description?: string): Priority {
        // This is a simple implementation that could be replaced with actual AI logic
        const importantKeywords = ['urgent', 'asap', 'emergency', 'deadline', 'critical'];
        const mediumKeywords = ['important', 'needed', 'required', 'soon'];

        const text = `${title} ${description || ''}`.toLowerCase();

        if (importantKeywords.some((keyword) => text.includes(keyword))) {
            return Priority.HIGH;
        }

        if (mediumKeywords.some((keyword) => text.includes(keyword))) {
            return Priority.MEDIUM;
        }

        return Priority.LOW;
    }

    suggestDeadline(task: Task): Date | null {
        // This could be enhanced with ML to learn from user patterns
        if (task.priority === Priority.HIGH) {
            // Suggest 24 hours for high priority tasks
            const deadline = new Date();
            deadline.setHours(deadline.getHours() + 24);
            return deadline;
        }

        if (task.priority === Priority.MEDIUM) {
            // Suggest 3 days for medium priority tasks
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 3);
            return deadline;
        }

        // Suggest 1 week for low priority tasks
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        return deadline;
    }

    estimateTaskDuration(title: string, description?: string): number | null {
        // This could be enhanced with ML to learn from historical task completion times
        const text = `${title} ${description || ''}`.toLowerCase();

        // Very simple estimation logic (in minutes)
        if (text.includes('quick') || text.includes('simple')) {
            return 30;
        }

        if (text.includes('meeting') || text.includes('call')) {
            return 60;
        }

        // Default to 2 hours for unknown tasks
        return 120;
    }

    async optimizeSchedule(tasks: Task[]): Promise<Task[]> {
        // This could be enhanced with actual ML-based optimization
        return tasks.sort((a, b) => {
            // Sort by priority first
            if (a.priority !== b.priority) {
                return b.priority.localeCompare(a.priority);
            }

            // Then by deadline if available
            if (a.deadline && b.deadline) {
                return a.deadline.getTime() - b.deadline.getTime();
            }

            if (a.deadline) return -1;
            if (b.deadline) return 1;

            // Finally by estimated time (shorter tasks first)
            if (a.estimatedTime && b.estimatedTime) {
                return a.estimatedTime - b.estimatedTime;
            }

            return 0;
        });
    }
}

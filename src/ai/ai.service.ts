import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LoggerService } from '../common/services/logger.service';
import { Priority, Task } from '@prisma/client';

/**
 * Enhanced AI Service with Gemini API Integration
 *
 * This service provides AI-powered task management features including:
 * - Smart priority analysis based on task content
 * - Intelligent deadline suggestions
 * - Task duration estimation
 * - Schedule optimization
 * - User behavior analysis and insights generation
 * - Comprehensive reporting with AI insights in Uzbek language
 *
 * All methods include fallback mechanisms for when AI is unavailable.
 */
@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(
        private readonly logger: LoggerService,
        private readonly configService: ConfigService,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    }

    async analyzePriority(title: string, description?: string): Promise<Priority> {
        try {
            const prompt = `
                Task Analysis Request:
                
                Title: "${title}"
                Description: "${description || 'No description provided'}"
                
                Analyze this task and determine its priority level based on:
                - Urgency indicators (urgent, asap, emergency, deadline, critical, immediate)
                - Importance keywords (important, needed, required, soon)
                - Context and implications
                
                Respond with ONLY one of these words:
                - HIGH (for urgent/critical tasks)
                - MEDIUM (for important but not urgent tasks)  
                - LOW (for routine/non-urgent tasks)
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim().toUpperCase();

            // Validate and return priority
            if (response.includes('HIGH')) return Priority.HIGH;
            if (response.includes('MEDIUM')) return Priority.MEDIUM;
            return Priority.LOW;
        } catch (error) {
            this.logger.error('Failed to analyze priority with AI, using fallback', error);
            return this.fallbackAnalyzePriority(title, description);
        }
    }

    private fallbackAnalyzePriority(title: string, description?: string): Priority {
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

    async suggestDeadline(task: Task): Promise<Date | null> {
        try {
            const prompt = `
                Task Deadline Suggestion:
                
                Title: "${task.title}"
                Description: "${task.description || 'No description'}"
                Priority: ${task.priority}
                Estimated Time: ${task.estimatedTime || 'Unknown'} minutes
                Created: ${task.createdAt.toISOString()}
                
                Based on this task information, suggest a realistic deadline. Consider:
                - Task priority (HIGH = urgent, MEDIUM = important, LOW = routine)
                - Estimated completion time
                - Best practices for task management
                
                Respond with ONLY a number representing hours from now when this task should be completed.
                Examples: 
                - For urgent tasks: 24 (24 hours)
                - For important tasks: 72 (3 days) 
                - For routine tasks: 168 (1 week)
                
                Respond with ONLY the number of hours.
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();
            const hours = parseInt(response);

            if (isNaN(hours) || hours <= 0) {
                return this.fallbackSuggestDeadline(task);
            }

            const deadline = new Date();
            deadline.setHours(deadline.getHours() + hours);
            return deadline;
        } catch (error) {
            this.logger.error('Failed to suggest deadline with AI, using fallback', error);
            return this.fallbackSuggestDeadline(task);
        }
    }

    private fallbackSuggestDeadline(task: Task): Date | null {
        if (task.priority === Priority.HIGH) {
            const deadline = new Date();
            deadline.setHours(deadline.getHours() + 24);
            return deadline;
        }

        if (task.priority === Priority.MEDIUM) {
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 3);
            return deadline;
        }

        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        return deadline;
    }

    async estimateTaskDuration(title: string, description?: string): Promise<number | null> {
        try {
            const prompt = `
                Task Duration Estimation:
                
                Title: "${title}"
                Description: "${description || 'No description provided'}"
                
                Estimate how many minutes this task will take to complete. Consider:
                - Task complexity
                - Common time requirements for similar tasks
                - Keywords that indicate duration (quick, meeting, project, etc.)
                
                Common estimates:
                - Quick tasks: 15-30 minutes
                - Simple tasks: 30-60 minutes  
                - Meetings/calls: 30-120 minutes
                - Complex projects: 120+ minutes
                
                Respond with ONLY a number representing estimated minutes.
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();
            const minutes = parseInt(response);

            if (isNaN(minutes) || minutes <= 0) {
                return this.fallbackEstimateTaskDuration(title, description);
            }

            return minutes;
        } catch (error) {
            this.logger.error('Failed to estimate duration with AI, using fallback', error);
            return this.fallbackEstimateTaskDuration(title, description);
        }
    }

    private fallbackEstimateTaskDuration(title: string, description?: string): number | null {
        const text = `${title} ${description || ''}`.toLowerCase();

        if (text.includes('quick') || text.includes('simple')) {
            return 30;
        }

        if (text.includes('meeting') || text.includes('call')) {
            return 60;
        }

        return 120;
    }

    async optimizeSchedule(tasks: Task[]): Promise<Task[]> {
        try {
            const tasksData = tasks.map((task) => ({
                id: task.id,
                title: task.title,
                priority: task.priority,
                deadline: task.deadline?.toISOString(),
                estimatedTime: task.estimatedTime,
                status: task.status,
                createdAt: task.createdAt.toISOString(),
            }));

            const prompt = `
                Task Schedule Optimization:
                
                Tasks to optimize:
                ${JSON.stringify(tasksData, null, 2)}
                
                Please optimize the order of these tasks based on:
                1. Priority (HIGH > MEDIUM > LOW)
                2. Deadlines (earlier deadlines first)
                3. Estimated time (shorter tasks can be done first if same priority)
                4. Task dependencies and logical flow
                
                Respond with ONLY a JSON array of task IDs in the optimized order.
                Example: ["task-id-1", "task-id-2", "task-id-3"]
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            // Try to parse the JSON response
            const optimizedOrder = JSON.parse(response);

            if (Array.isArray(optimizedOrder)) {
                // Reorder tasks based on AI response
                const orderedTasks: Task[] = [];
                const taskMap = new Map(tasks.map((task) => [task.id, task]));

                // Add tasks in AI-suggested order
                optimizedOrder.forEach((taskId) => {
                    const task = taskMap.get(taskId);
                    if (task) {
                        orderedTasks.push(task);
                        taskMap.delete(taskId);
                    }
                });

                // Add any remaining tasks
                taskMap.forEach((task) => orderedTasks.push(task));

                return orderedTasks;
            }

            return this.fallbackOptimizeSchedule(tasks);
        } catch (error) {
            this.logger.error('Failed to optimize schedule with AI, using fallback', error);
            return this.fallbackOptimizeSchedule(tasks);
        }
    }

    private fallbackOptimizeSchedule(tasks: Task[]): Task[] {
        return tasks.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority.localeCompare(a.priority);
            }

            if (a.deadline && b.deadline) {
                return a.deadline.getTime() - b.deadline.getTime();
            }

            if (a.deadline) return -1;
            if (b.deadline) return 1;

            if (a.estimatedTime && b.estimatedTime) {
                return a.estimatedTime - b.estimatedTime;
            }

            return 0;
        });
    }

    async analyzeUserBehavior(userActions: UserAction[]): Promise<string> {
        try {
            const prompt = `
                User Behavior Analysis:
                
                Recent user actions:
                ${JSON.stringify(userActions, null, 2)}
                
                Analyze this user's task management patterns and provide insights:
                1. Task completion patterns
                2. Priority preferences
                3. Time management habits
                4. Suggestions for improvement
                
                Provide a helpful response in Uzbek language that the user can understand.
                Keep it concise and actionable.
            `;

            const result = await this.model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            this.logger.error('Failed to analyze user behavior', error);
            return "Foydalanuvchi xatti-harakatlari tahlil qilinmadi. Keyinroq qayta urinib ko'ring.";
        }
    }

    async generateTaskSuggestions(userContext: string): Promise<string[]> {
        try {
            const prompt = `
                Task Suggestion Generator:
                
                User context: "${userContext}"
                
                Based on this context, suggest 3-5 relevant tasks that the user might want to add.
                Consider:
                - Common daily/weekly tasks
                - Work-related activities
                - Personal development
                - Health and wellness
                
                Respond with a JSON array of task suggestions in Uzbek language.
                Example: ["Kitob o'qish", "Sport mashqlari", "Ish hisobotini tayyorlash"]
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            try {
                const suggestions = JSON.parse(response);
                return Array.isArray(suggestions) ? suggestions : [];
            } catch {
                return [];
            }
        } catch (error) {
            this.logger.error('Failed to generate task suggestions', error);
            return [];
        }
    }

    async generateReportInsights(
        reportData: any,
    ): Promise<{ insights: string[]; recommendations: string[] }> {
        try {
            const prompt = `
                Task Management Report Analysis:
                
                Period: ${reportData.period}
                Total Tasks: ${reportData.analytics?.totalTasks || 0}
                Completed Tasks: ${reportData.analytics?.completedTasks || 0}
                Completion Rate: ${reportData.analytics?.completionRate || 0}%
                Productivity Score: ${reportData.analytics?.productivityScore || 0}/100
                Overdue Tasks: ${reportData.analytics?.overdueeTasks || 0}
                
                Priority Distribution:
                - High: ${reportData.analytics?.priorityDistribution?.high || 0}
                - Medium: ${reportData.analytics?.priorityDistribution?.medium || 0}
                - Low: ${reportData.analytics?.priorityDistribution?.low || 0}
                
                Based on this data, provide:
                1. 2-3 key insights about user's productivity patterns
                2. 2-3 specific recommendations for improvement
                
                Respond in Uzbek language with JSON format:
                {
                    "insights": ["insight1", "insight2", "insight3"],
                    "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
                }
                
                Focus on practical, actionable advice.
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            try {
                const parsed = JSON.parse(response);
                return {
                    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
                    recommendations: Array.isArray(parsed.recommendations)
                        ? parsed.recommendations
                        : [],
                };
            } catch {
                return this.getFallbackInsights(reportData);
            }
        } catch (error) {
            this.logger.error('Failed to generate report insights', error);
            return this.getFallbackInsights(reportData);
        }
    }

    private getFallbackInsights(reportData: any): {
        insights: string[];
        recommendations: string[];
    } {
        const completionRate = reportData.analytics?.completionRate || 0;
        const productivityScore = reportData.analytics?.productivityScore || 0;
        const overdueeTasks = reportData.analytics?.overdueeTasks || 0;

        const insights: string[] = [];
        const recommendations: string[] = [];

        if (completionRate >= 80) {
            insights.push("🎯 Siz vazifalarni bajarishda juda yaxshi natijalar ko'rsatyapsiz!");
        } else if (completionRate >= 60) {
            insights.push("📊 Vazifalarni bajarish darajasi o'rtacha, yaxshilash imkoniyati bor.");
        } else {
            insights.push("⚠️ Vazifalarni bajarish darajasi pastroq, e'tibor talab qiladi.");
        }

        if (overdueeTasks > 0) {
            insights.push(`⏰ ${overdueeTasks} ta vazifa muddati o'tgan.`);
            recommendations.push(
                '🕐 Deadlinelarni aniqroq belgilang va eslatmalardan foydalaning.',
            );
        }

        if (productivityScore < 70) {
            recommendations.push('📅 Kunlik rejalashtirish va prioritetlashtirish ustida ishlang.');
            recommendations.push(
                '🎯 Kichik vazifalardan boshlang va muvaffaqiyatlarni nishonlang.',
            );
        } else {
            recommendations.push(
                '🚀 Yaxshi natijalar! Ushbu darajani saqlab qolishga harakat qiling.',
            );
        }

        return { insights, recommendations };
    }
}

interface UserAction {
    type: 'create_task' | 'complete_task' | 'update_task' | 'delete_task';
    taskId?: string;
    taskTitle?: string;
    timestamp: string;
    priority?: Priority;
}

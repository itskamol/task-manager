import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { LoggerService } from '../common/services/logger.service';
import { Priority, Task } from '@prisma/client';
import { addTimeInTimezone } from '../tasks/utils/time.utils';

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
    private model: GenerativeModel;

    constructor(
        private readonly logger: LoggerService,
        private readonly configService: ConfigService,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
        const text = `${title} ${description || ''}`.toLowerCase();

        // Enhanced keyword lists with more comprehensive detection
        const urgentKeywords = [
            'urgent',
            'asap',
            'emergency',
            'deadline',
            'critical',
            'immediate',
            'shoshilinch',
            'zudlik bilan',
            'tezkor',
            'muhim',
            'zarur',
        ];

        const importantKeywords = [
            'important',
            'needed',
            'required',
            'soon',
            'priority',
            'necessary',
            'kerak',
            'lozim',
            'zarur',
            'muhim',
            'ahamiyatli',
        ];

        const lowPriorityKeywords = [
            'later',
            'eventually',
            'when possible',
            'sometime',
            'routine',
            'keyinroq',
            "imkon bo'lganda",
            'oddiy',
            'muntazam',
        ];

        // Check for explicit priority mentions
        if (/high|yuqori|baland/i.test(text)) return Priority.HIGH;
        if (/medium|o'rta|o'rtacha/i.test(text)) return Priority.MEDIUM;
        if (/low|past|oddiy/i.test(text)) return Priority.LOW;

        // Check urgent keywords first
        if (urgentKeywords.some((keyword) => text.includes(keyword))) {
            return Priority.HIGH;
        }

        // Check low priority keywords
        if (lowPriorityKeywords.some((keyword) => text.includes(keyword))) {
            return Priority.LOW;
        }

        // Check important keywords
        if (importantKeywords.some((keyword) => text.includes(keyword))) {
            return Priority.MEDIUM;
        }

        // Default based on length and context
        if (text.length < 10) {
            return Priority.LOW; // Short tasks are usually simple
        }

        return Priority.MEDIUM; // Default to medium priority
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
            console.log(`AI suggested deadline in hours: ${hours}`);
            if (isNaN(hours) || hours <= 0) {
                return this.fallbackSuggestDeadline(task);
            }

            // Use task timezone for deadline calculation
            const taskTimezone = task.timezone || 'Asia/Tashkent';
            const deadline = addTimeInTimezone(new Date(), hours, 'hours', taskTimezone);
            console.log(
                `Calculated deadline: ${deadline.toISOString()} for timezone: ${taskTimezone}`,
            );
            return deadline;
        } catch (error) {
            this.logger.error('Failed to suggest deadline with AI, using fallback', error);
            return this.fallbackSuggestDeadline(task);
        }
    }

    private fallbackSuggestDeadline(task: Task): Date | null {
        const taskTimezone = task.timezone || 'Asia/Tashkent';

        if (task.priority === Priority.HIGH) {
            // High priority: 24 hours from now
            return addTimeInTimezone(new Date(), 24, 'hours', taskTimezone);
        }

        if (task.priority === Priority.MEDIUM) {
            // Medium priority: 3 days from now
            return addTimeInTimezone(new Date(), 3, 'days', taskTimezone);
        }

        // Low priority: 1 week from now
        return addTimeInTimezone(new Date(), 1, 'weeks', taskTimezone);
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
            if (tasks.length === 0) {
                return tasks;
            }

            const prompt = `
            Analyze these tasks and suggest the optimal order for completion.
            Consider priority, deadlines, and estimated time.
            
            Tasks:
            ${tasks
                .map(
                    (task) =>
                        `- ID: ${task.id}, Title: ${task.title}, Priority: ${task.priority}, 
                 Deadline: ${task.deadline || 'No deadline'}, 
                 Estimated: ${task.estimatedTime || 'Unknown'} minutes`,
                )
                .join('\n')}
            
            Return ONLY a valid JSON array with the task IDs in optimal order.
            Example: ["task-id-1", "task-id-2", "task-id-3"]
            
            Do not include any markdown formatting or explanations.
        `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            // Clean up response by removing markdown code blocks
            const cleanedResponse = this.cleanJsonResponse(response);

            try {
                const optimizedIds = JSON.parse(cleanedResponse);

                if (!Array.isArray(optimizedIds)) {
                    throw new Error('Response is not an array');
                }

                // Reorder tasks based on AI suggestion
                const orderedTasks = optimizedIds
                    .map((id) => tasks.find((task) => task.id === id))
                    .filter((task) => task !== undefined) as Task[];

                // Add any tasks that weren't in the AI response
                const remainingTasks = tasks.filter((task) => !optimizedIds.includes(task.id));

                return [...orderedTasks, ...remainingTasks];
            } catch (parseError) {
                this.logger.warn('Failed to parse AI schedule optimization response', {
                    response: cleanedResponse,
                    error: parseError,
                });
                return this.fallbackScheduleOptimization(tasks);
            }
        } catch (error) {
            this.logger.error('Failed to optimize schedule with AI, using fallback', error);
            return this.fallbackScheduleOptimization(tasks);
        }
    }

    private cleanJsonResponse(response: string): string {
        // Remove markdown code block syntax
        let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();

        // If response starts and ends with quotes, remove them
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
        }

        return cleaned;
    }

    private fallbackScheduleOptimization(tasks: Task[]): Task[] {
        // Simple fallback: sort by priority and deadline
        return tasks.sort((a, b) => {
            // First by priority (HIGH -> MEDIUM -> LOW)
            const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            const priorityDiff =
                (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);

            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            // Then by deadline (earlier deadlines first)
            if (a.deadline && b.deadline) {
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            }

            if (a.deadline && !b.deadline) return -1;
            if (!a.deadline && b.deadline) return 1;

            // Finally by creation date (newer first)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

    async analyzeTaskAndGenerateQuestions(taskText: string): Promise<{
        needsMoreInfo: boolean;
        questions: string[];
        suggestedData: {
            priority: Priority;
            estimatedTime: number | null;
        };
    }> {
        try {
            const prompt = `
                Task Analysis for Interactive Creation:
                
                User input: "${taskText}"
                
                Analyze this task and determine:
                1. Is this task description clear and complete? 
                2. What additional information might be helpful?
                3. Suggest initial priority and estimated time
                
                Respond in JSON format:
                {
                    "needsMoreInfo": boolean,
                    "questions": ["question1", "question2"],
                    "suggestedPriority": "HIGH|MEDIUM|LOW",
                    "suggestedTime": number_in_minutes
                }
                
                Ask questions in Uzbek language. Examples:
                - "Bu vazifa qachon bajarilishi kerak?"
                - "Bu vazifa qanchalik muhim (yuqori, o'rta, past)?"
                - "Qo'shimcha tafsilotlar bormi?"
                - "Bu vazifa uchun qancha vaqt kerak?"
                
                Only ask 1-2 most important questions if task is unclear.
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            try {
                const parsed = this.parseAIJsonResponse<{
                    needsMoreInfo: boolean;
                    questions: string[];
                    suggestedPriority: string;
                    suggestedTime: number | null;
                }>(response);

                return {
                    needsMoreInfo: parsed.needsMoreInfo || false,
                    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
                    suggestedData: {
                        priority: this.parsePriority(parsed.suggestedPriority),
                        estimatedTime: parsed.suggestedTime || null,
                    },
                };
            } catch {
                return this.fallbackTaskAnalysis(taskText);
            }
        } catch (error) {
            this.logger.error('Failed to analyze task for interactive creation', error);
            return this.fallbackTaskAnalysis(taskText);
        }
    }

    private parsePriority(priorityString: string): Priority {
        if (priorityString && priorityString.toUpperCase().includes('HIGH')) {
            return Priority.HIGH;
        }
        if (priorityString && priorityString.toUpperCase().includes('LOW')) {
            return Priority.LOW;
        }
        return Priority.MEDIUM;
    }

    private parseAIJsonResponse<T>(response: string): T {
        let cleaned = '';
        try {
            // Remove markdown code blocks and any other formatting
            cleaned = response
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .replace(/`/g, '');

            // Remove leading/trailing whitespace
            cleaned = cleaned.trim();

            // Remove outer quotes if present
            if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                cleaned = cleaned.slice(1, -1);
            }

            // Try to extract JSON from text if wrapped in other content
            const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
                cleaned = jsonMatch[0];
            }

            // Parse JSON
            return JSON.parse(cleaned);
        } catch (error) {
            this.logger.warn('Failed to parse AI JSON response', {
                originalResponse: response,
                cleanedResponse: cleaned,
                error: error.message,
            });
            throw new Error(`Failed to parse AI JSON response: ${error.message}`);
        }
    }

    private fallbackTaskAnalysis(taskText: string): {
        needsMoreInfo: boolean;
        questions: string[];
        suggestedData: {
            priority: Priority;
            estimatedTime: number | null;
        };
    } {
        const text = taskText.trim();
        const words = text.split(/\s+/);
        const hasUrgentKeywords = /urgent|asap|critical|important|shoshilinch|muhim|zarur/i.test(
            text,
        );
        const hasTimeIndicators = /today|tomorrow|week|month|bugun|ertaga|hafta|oy/i.test(text);
        const hasCompleteInfo = words.length >= 3 && (hasTimeIndicators || hasUrgentKeywords);

        // Enhanced condition - ask more questions for better interaction
        const needsMoreInfo =
            text.length < 10 || // Less than 10 characters
            words.length < 3 || // Less than 3 words
            !hasCompleteInfo; // Lacks complete context

        const questions: string[] = [];
        if (needsMoreInfo) {
            if (text.length < 5) {
                questions.push("Bu vazifa haqida ko'proq ma'lumot bera olasizmi?");
            } else if (!hasTimeIndicators && !hasUrgentKeywords) {
                questions.push('Bu vazifa qachon bajarilishi kerak?');
            } else if (words.length < 3) {
                questions.push("Qo'shimcha tafsilotlar bera olasizmi?");
            }
        }

        // Estimate priority based on keywords and context
        let priority: Priority = Priority.MEDIUM;
        if (hasUrgentKeywords) {
            priority = Priority.HIGH;
        } else if (text.length < 15 || /simple|quick|oddiy|tez/i.test(text)) {
            priority = Priority.LOW;
        }

        // Estimate time based on task content
        let estimatedTime = 60; // default 1 hour
        if (/quick|tez|simple|oddiy/i.test(text)) {
            estimatedTime = 30;
        } else if (/meeting|uchrashuv|call|qo'ng'iroq/i.test(text)) {
            estimatedTime = 60;
        } else if (/project|loyiha|complex|murakkab/i.test(text)) {
            estimatedTime = 180;
        }

        return {
            needsMoreInfo,
            questions,
            suggestedData: {
                priority,
                estimatedTime,
            },
        };
    }
}

interface UserAction {
    type: 'create_task' | 'complete_task' | 'update_task' | 'delete_task';
    taskId?: string;
    taskTitle?: string;
    timestamp: string;
    priority?: Priority;
}

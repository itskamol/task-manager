import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { LoggerService } from '../common/services/logger.service';
import { Priority, Task } from '@prisma/client';
import { addTimeInTimezone } from '../tasks/utils/time.utils';

/**
 * AI Service with Gemini API Integration
 *
 * Essential task management AI features:
 * - Smart priority analysis based on task content
 * - Intelligent deadline suggestions
 * - Task duration estimation
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
            this.logger.debug('Analyzing task priority', {
                title: title.substring(0, 50),
                hasDescription: !!description,
            });

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

            this.logger.debug('Priority analysis completed', {
                response,
                title: title.substring(0, 50),
            });

            // Validate and return priority
            if (response.includes('HIGH')) return Priority.HIGH;
            if (response.includes('MEDIUM')) return Priority.MEDIUM;
            return Priority.LOW;
        } catch (error) {
            this.logger.error('Failed to analyze priority with AI, using fallback', error, {
                context: 'AiService',
            });
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
            this.logger.debug('Suggesting deadline for task', {
                taskId: task.id,
                title: task.title.substring(0, 50),
            });

            const prompt = `
                Task Deadline Analysis:
                Title: "${task.title}"
                Priority: ${task.priority}
                ${task.description ? `Description: "${task.description}"` : ''}
                
                Suggest a reasonable deadline based on priority and content.
                Consider:
                - HIGH priority: within 48 hours
                - MEDIUM priority: within 5 days
                - LOW priority: within 2 weeks
                
                Respond with ONLY a number between 1-14 (days).
            `;

            const result = await this.model.generateContent(prompt);
            const daysText = result.response.text().trim();
            const days = parseInt(daysText, 10);

            if (isNaN(days) || days < 1 || days > 14) {
                this.logger.warn('Invalid deadline suggestion from AI, using fallback', {
                    response: daysText,
                    taskId: task.id,
                });
                return this.fallbackSuggestDeadline(task);
            }

            this.logger.debug('Deadline suggestion generated', {
                taskId: task.id,
                suggestedDays: days,
            });

            return addTimeInTimezone(new Date(), days * 24, 'hours', task.timezone);
        } catch (error) {
            this.logger.error('Failed to suggest deadline with AI, using fallback', error, {
                context: 'AiService',
                taskId: task.id,
            });
            return this.fallbackSuggestDeadline(task);
        }
    }

    private fallbackSuggestDeadline(task: Task): Date | null {
        const days =
            task.priority === Priority.HIGH ? 2 : task.priority === Priority.MEDIUM ? 5 : 14;

        return addTimeInTimezone(new Date(), days * 24, 'hours', task.timezone);
    }

    async estimateTaskDuration(taskText: string): Promise<number | null> {
        try {
            this.logger.debug('Estimating task duration', {
                text: taskText.substring(0, 50),
            });

            const prompt = `
                Task Duration Estimation:
                Task: "${taskText}"
                
                Analyze this task and estimate how many minutes it might take.
                Consider:
                - Task complexity
                - Required steps
                - Similar common tasks
                
                Respond with ONLY a number (minutes).
                Keep estimates realistic and moderate (15-480 minutes).
            `;

            const result = await this.model.generateContent(prompt);
            const minutesText = result.response.text().trim();
            const minutes = parseInt(minutesText, 10);

            if (isNaN(minutes) || minutes < 15 || minutes > 480) {
                this.logger.warn('Invalid duration estimate from AI, returning null', {
                    response: minutesText,
                });
                return null;
            }

            this.logger.debug('Duration estimate generated', { minutes });
            return minutes;
        } catch (error) {
            this.logger.error('Failed to estimate task duration, returning null', error, {
                context: 'AiService',
            });
            return null;
        }
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
                Task Analysis:
                "${taskText}"
                
                Analyze this task description and return a JSON response with:
                1. Whether more information is needed (boolean)
                2. Questions to ask user for clarity (array of strings in Uzbek)
                3. Suggested priority (HIGH/MEDIUM/LOW)
                4. Estimated time in minutes (number)
                
                Example format:
                {
                    "needsMoreInfo": true,
                    "questions": ["Deadline qachon?", "Boshqalar bilan ishlaysizmi?"],
                    "suggestedPriority": "HIGH",
                    "suggestedTime": 120
                }
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            try {
                const cleaned = response.replace(/^```json\n|\n```$/g, '');
                const parsed = JSON.parse(cleaned);

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
        const prio = (priorityString || '').toUpperCase();
        if (prio.includes('HIGH')) return Priority.HIGH;
        if (prio.includes('MEDIUM')) return Priority.MEDIUM;
        return Priority.LOW;
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

        const needsMoreInfo = text.length < 10 || words.length < 3 || !hasCompleteInfo;

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

        let priority: Priority = Priority.MEDIUM;
        if (hasUrgentKeywords) {
            priority = Priority.HIGH;
        } else if (text.length < 10 || (!hasTimeIndicators && !hasUrgentKeywords)) {
            priority = Priority.LOW;
        }

        return {
            needsMoreInfo,
            questions,
            suggestedData: {
                priority,
                estimatedTime: null,
            },
        };
    }

    async generateReportInsights(reportData: {
        period: string;
        tasks: Task[];
        analytics: any;
        date: string;
    }): Promise<{ insights: string[]; recommendations: string[] }> {
        try {
            this.logger.debug('Generating report insights', {
                period: reportData.period,
                taskCount: reportData.tasks.length,
                productivityScore: reportData.analytics?.productivityScore,
            });

            const prompt = `
                Report Analysis Request:
                
                Period: ${reportData.period}
                Date: ${reportData.date}
                Tasks analyzed: ${reportData.tasks.length}
                
                Analytics Summary:
                - Total tasks: ${reportData.analytics?.totalTasks || 0}
                - Completed: ${reportData.analytics?.completedTasks || 0}
                - Completion rate: ${reportData.analytics?.completionRate || 0}%
                - Productivity score: ${reportData.analytics?.productivityScore || 0}/100
                - Average completion time: ${reportData.analytics?.averageCompletionTime || 0} minutes
                - Overdue tasks: ${reportData.analytics?.overdueeTasks || 0}
                
                Priority distribution:
                - High: ${reportData.analytics?.priorityDistribution?.high || 0}
                - Medium: ${reportData.analytics?.priorityDistribution?.medium || 0}
                - Low: ${reportData.analytics?.priorityDistribution?.low || 0}
                
                Analyze this data and provide:
                1. Key insights about performance (3-4 insights)
                2. Actionable recommendations for improvement (3-4 recommendations)
                
                Respond in JSON format with insights and recommendations in Uzbek language:
                {
                    "insights": ["insight1", "insight2", "insight3"],
                    "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
                }
                
                Keep insights factual and recommendations practical.
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            try {
                const cleaned = response.replace(/^```json\n|\n```$/g, '');
                const parsed = JSON.parse(cleaned);

                if (Array.isArray(parsed.insights) && Array.isArray(parsed.recommendations)) {
                    this.logger.debug('Report insights generated successfully', {
                        insightsCount: parsed.insights.length,
                        recommendationsCount: parsed.recommendations.length,
                    });

                    return {
                        insights: parsed.insights,
                        recommendations: parsed.recommendations,
                    };
                }
            } catch (parseError) {
                this.logger.warn('Failed to parse AI response, using fallback', {
                    response: response.substring(0, 100),
                });
            }

            return this.fallbackGenerateInsights(reportData);
        } catch (error) {
            this.logger.error('Failed to generate report insights with AI, using fallback', error, {
                context: 'AiService',
                period: reportData.period,
            });
            return this.fallbackGenerateInsights(reportData);
        }
    }

    private fallbackGenerateInsights(reportData: {
        period: string;
        tasks: Task[];
        analytics: any;
    }): { insights: string[]; recommendations: string[] } {
        const analytics = reportData.analytics || {};
        const insights: string[] = [];
        const recommendations: string[] = [];

        // Generate insights based on analytics
        const completionRate = analytics.completionRate || 0;
        const productivityScore = analytics.productivityScore || 0;
        const overdueCount = analytics.overdueeTasks || 0;
        const totalTasks = analytics.totalTasks || 0;

        // Completion rate insights
        if (completionRate >= 80) {
            insights.push("Siz bajarilish darajasi bo'yicha ajoyib natijalar ko'rsatyapsiz");
        } else if (completionRate >= 60) {
            insights.push('Bajarilish darajangiz yaxshi, lekin yaxshilash mumkin');
        } else {
            insights.push('Vazifalarni bajarishda qiyinchiliklar mavjud');
        }

        // Productivity insights
        if (productivityScore >= 85) {
            insights.push('Samaradorlik darajangiz juda yuqori');
        } else if (productivityScore >= 65) {
            insights.push("O'rtacha samaradorlik ko'rsatkichingiz normal");
        } else {
            insights.push('Samaradorlikni oshirish zarur');
        }

        // Overdue insights
        if (overdueCount === 0 && totalTasks > 0) {
            insights.push("Barcha vazifalar o'z vaqtida bajarilmoqda");
        } else if (overdueCount > 0) {
            insights.push(`${overdueCount} ta vazifa muddati o\'tgan`);
        }

        // Task volume insights
        if (totalTasks > 0) {
            if (reportData.period === 'daily' && totalTasks >= 5) {
                insights.push('Kunlik vazifalar soni yetarli');
            } else if (reportData.period === 'weekly' && totalTasks >= 20) {
                insights.push('Haftalik faolligingiz yuqori');
            }
        }

        // Generate recommendations
        if (completionRate < 70) {
            recommendations.push("Vazifalarni kichikroq qismlarga bo'ling");
            recommendations.push('Kunlik rejani aniqroq belgilang');
        }

        if (overdueCount > 0) {
            recommendations.push('Muddatlarni realistik belgilang');
            recommendations.push('Eslatma tizimidan foydalaning');
        }

        if (productivityScore < 60) {
            recommendations.push("Eng muhim vazifalarni birinchi o'ringa qo'ying");
            recommendations.push("Chalg'ituvchi omillarni kamaytiring");
        }

        if (analytics.priorityDistribution?.high > analytics.priorityDistribution?.low) {
            recommendations.push('Muhimlik darajalarini muvozanatlashtiring');
        }

        // Ensure we have at least some recommendations
        if (recommendations.length === 0) {
            recommendations.push('Doimiy takomillashda davom eting');
            recommendations.push("O'z yutuqlaringizni tahlil qiling");
        }

        return {
            insights: insights.slice(0, 4), // Limit to 4 insights
            recommendations: recommendations.slice(0, 4), // Limit to 4 recommendations
        };
    }

    async optimizeSchedule(tasks: Task[]): Promise<Task[]> {
        try {
            this.logger.debug('Optimizing task schedule', {
                taskCount: tasks.length,
            });

            if (tasks.length === 0) {
                return tasks;
            }

            const prompt = `
                Task Schedule Optimization:
                
                Tasks to optimize: ${tasks.length}
                
                Task details:
                ${tasks
                    .map(
                        (task, index) => `
                ${index + 1}. "${task.title}"
                   Priority: ${task.priority}
                   Deadline: ${task.deadline ? task.deadline.toISOString() : 'None'}
                   Status: ${task.status}
                   Estimated time: ${task.estimatedTime || 'Unknown'} minutes
                `,
                    )
                    .join('\n')}
                
                Optimize the order of these tasks based on:
                1. Priority (HIGH > MEDIUM > LOW)
                2. Deadlines (urgent first)
                3. Estimated completion time
                4. Task dependencies and workflow
                
                Return the optimized order as JSON array of task indices (0-based):
                {"order": [2, 0, 1, 3, ...]}
                
                Keep the optimization practical and logical.
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            try {
                const cleaned = response.replace(/^```json\n|\n```$/g, '');
                const parsed = JSON.parse(cleaned);

                if (Array.isArray(parsed.order) && parsed.order.length === tasks.length) {
                    // Validate indices
                    const validOrder = parsed.order.every(
                        (index: number) =>
                            Number.isInteger(index) && index >= 0 && index < tasks.length,
                    );

                    if (validOrder) {
                        const optimizedTasks = parsed.order.map((index: number) => tasks[index]);

                        this.logger.debug('Task schedule optimized successfully', {
                            originalOrder: tasks.map((t) => t.title.substring(0, 20)),
                            optimizedOrder: optimizedTasks.map((t) => t.title.substring(0, 20)),
                        });

                        return optimizedTasks;
                    }
                }
            } catch (parseError) {
                this.logger.warn('Failed to parse AI schedule optimization, using fallback', {
                    response: response.substring(0, 100),
                });
            }

            return this.fallbackOptimizeSchedule(tasks);
        } catch (error) {
            this.logger.error('Failed to optimize schedule with AI, using fallback', error, {
                context: 'AiService',
            });
            return this.fallbackOptimizeSchedule(tasks);
        }
    }

    private fallbackOptimizeSchedule(tasks: Task[]): Task[] {
        // Simple fallback optimization based on priority and deadline
        return [...tasks].sort((a, b) => {
            // First, sort by priority
            const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            // Then by deadline (earlier deadlines first)
            if (a.deadline && b.deadline) {
                return a.deadline.getTime() - b.deadline.getTime();
            }

            if (a.deadline && !b.deadline) {
                return -1; // Tasks with deadlines come first
            }

            if (!a.deadline && b.deadline) {
                return 1;
            }

            // Finally by estimated time (shorter tasks first for quick wins)
            const timeA = a.estimatedTime || 60; // Default to 60 minutes if not set
            const timeB = b.estimatedTime || 60;

            return timeA - timeB;
        });
    }

    // In AiService

    async understandUserIntent(
        messageText: string,
        userId: string /* for context if needed */,
    ): Promise<{
        intent: string; // e.g., 'CREATE_TASK', 'CREATE_REMINDER', 'CHITCHAT', 'LIST_TASKS', 'UNKNOWN'
        entities: Record<string, any>; // Extracted data like title, deadline
        isComplete: boolean;
        clarificationQuestions?: string[];
    }> {
        try {
            this.logger.debug('Understanding user intent', { text: messageText.substring(0, 50) });
            const prompt = `
            Foydalanuvchining Telegramdagi xabari: "${messageText}"

            Bu xabarni tahlil qilib, uning asosiy maqsadini ("intent") va xabardagi muhim ma'lumotlarni ("entities") JSON formatida aniqlab ber.
            
            Mumkin bo'lgan "intent"lar:
            - "CREATE_TASK": Agar foydalanuvchi biror ish qilish kerakligini aytsa (masalan, "non olishim kerak", "prezentatsiya tayyorlash").
            - "CREATE_REMINDER": Agar foydalanuvchi biror narsani eslatishni so'rasa (masalan, "ertaga soat 5da qo'ng'iroq qilishni eslat").
            - "LIST_TASKS": Agar foydalanuvchi vazifalar ro'yxatini so'rasa.
            - "CHITCHAT": Agar xabar shunchaki suhbat yoki savol bo'lsa va aniq vazifa/eslatmaga tegishli bo'lmasa.
            - "UNKNOWN": Agar maqsad umuman tushunarsiz bo'lsa.

            "entities" ichida quyidagilarni ajratishga harakat qil:
            - "actionPhrase": Vazifa yoki eslatmaning asosiy matni (masalan, "non olish", "prezentatsiya tayyorlash", "qo'ng'iroq qilish").
            - "deadline": Agar sana va/yoki vaqt aniq aytilgan bo'lsa, uni ISO 8601 formatida (YYYY-MM-DDTHH:mm:ss) ko'rsat. Agar faqat sana bo'lsa, T00:00:00 ishlat. Nisbiy vaqtlarni (masalan, "ertaga", "2 soatdan keyin") ham shu formatga o'tkazishga harakat qil (hozirgi vaqtni YYYY-MM-DDTHH:mm:ss deb hisobla).
            - "persoNames": Agar xabarda odam ismlari bo'lsa (masalan, "Alisher bilan uchrashuv").
            - "location_names": Agar joy nomlari bo'lsa.

            Shuningdek, quyidagi boolean qiymatni ham qaytar:
            - "isInformationSufficient": Agar "CREATE_TASK" yoki "CREATE_REMINDER" maqsadi uchun asosiy ma'lumotlar (masalan, "actionPhrase") yetarli bo'lsa, 'true', aks holda 'false'.

            Agar "isInformatioSsufficient" 'false' bo'lsa, yetishmayotgan ma'lumotlarni so'rash uchun o'zbek tilida 1-2 ta aniqlashtiruvchi savolni "clarificationQuestions" massivida qaytar.

            Faqat JSON obyektini qaytar. Boshqa hech qanday matn qo'shma.

            Misollar:
            Xabar: "Ertaga soat 3da Alisher bilan uchrashishim kerak."
            Javob:
            {
              "intent": "CREATE_TASK",
              "entities": {
                "actionPhrase": "Alisher bilan uchrashish",
                "deadline": "YYYY-MM-(ErtangiSana)T15:00:00", 
                "persoNames": ["Alisher"]
              },
              "isInformationSufficient": true,
              "clarificationQuestions": []
            }

            Xabar: "Sut olishni unutma."
            Javob:
            {
              "intent": "CREATE_TASK",
              "entities": {
                "actionPhrase": "Sut olish"
              },
              "isInformationSufficient": false,
              "clarificationQuestions": ["Qachonga sut olish kerak?", "Qayerdan sut olish kerak? (ixtiyoriy)"]
            }

            Xabar: "Salom, qandaysan?"
            Javob:
            {
              "intent": "CHITCHAT",
              "entities": {},
              "isInformationSufficient": true,
              "clarificationQuestions": []
            }
        `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim();

            this.logger.debug('User intent understood', {
                response: response.substring(0, 100),
            });

            try {
                const cleaned = response.replace(/^```json\n|\n```$/g, '');
                const parsed = JSON.parse(cleaned);

                // Validate the response structure
                if (
                    typeof parsed.intent === 'string' &&
                    typeof parsed.isInformationSufficient === 'boolean' &&
                    typeof parsed.entities === 'object' &&
                    (Array.isArray(parsed.clarificationQuestions) ||
                        parsed.clarificationQuestions === undefined)
                ) {
                    return {
                        intent: parsed.intent,
                        entities: parsed.entities || {},
                        isComplete: parsed.isInformationSufficient,
                        clarificationQuestions: parsed.clarificationQuestions || [],
                    };
                } else {
                    this.logger.warn('Invalid AI response format, using fallback', {
                        response: cleaned.substring(0, 100),
                    });
                }
            } catch (parseError) {
                this.logger.warn('Failed to parse AI response, using fallback', {
                    response: response.substring(0, 100),
                });
            }

            const DUMMY_AI_RESPONSE = {
                intent: 'UNKNOWN',
                entities: {},
                isComplete: false, // Aslida 'isInformatioSsufficient' bo'lishi kerak
                clarificationQuestions: ['Kechirasiz, tushunmadim. Aniqroq ayta olasizmi?'],
            };
            return DUMMY_AI_RESPONSE;
        } catch (error) {
            this.logger.error('Failed to understand user intent', error, { context: 'AiService' });
            return {
                intent: 'UNKNOWN',
                entities: {},
                isComplete: false,
                clarificationQuestions: [
                    "AI bilan bog'lanishda xatolik. Iltimos, /add buyrug'idan foydalaning.",
                ],
            };
        }
    }
}

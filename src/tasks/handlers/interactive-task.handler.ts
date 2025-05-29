import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { TasksService } from '../../tasks/tasks.service';
import { AiService } from '../../ai/ai.service';
import { SessionService } from '../../bot/services/session.service';
import { SessionState, TaskCreationData } from '../../bot/interfaces/session.interface';
import { Priority } from '@prisma/client';
import { LoggerService } from '../../common/services/logger.service';

@Injectable()
export class InteractiveTaskHandler {
    constructor(
        private readonly tasksService: TasksService,
        private readonly aiService: AiService,
        private readonly sessionService: SessionService,
        private readonly logger: LoggerService,
    ) {}

    async handleTaskCreation(ctx: Context, taskText: string): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) {
            await ctx.reply('❌ Foydalanuvchi identifikatsiyasida xatolik.');
            return;
        }

        try {
            // Analyze task with AI
            const analysis = await this.aiService.analyzeTaskAndGenerateQuestions(taskText);

            if (analysis.needsMoreInfo && analysis.questions.length > 0) {
                // Start interactive session
                this.sessionService.updateSession(userId, chatId, {
                    state: SessionState.ASKING_DETAILS,
                    data: {
                        taskTitle: taskText,
                        priority: analysis.suggestedData.priority,
                        estimatedTime: analysis.suggestedData.estimatedTime || 60,
                        questions: analysis.questions,
                        currentQuestionIndex: 0,
                    },
                });

                await this.askNextQuestion(ctx);
            } else {
                // Task is clear enough, create directly
                await this.createTaskDirectly(ctx, taskText, analysis.suggestedData);
            }
        } catch (error) {
            this.logger.error('Error in handleTaskCreation', error);
            await ctx.reply(
                '❌ Vazifa tahlil qilishda xatolik yuz berdi. Oddiy usulda yaratiladi...',
            );
            await this.createTaskDirectly(ctx, taskText, {
                priority: Priority.MEDIUM,
                estimatedTime: 60,
            });
        }
    }

    async handleResponse(ctx: Context, response: string): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        const session = this.sessionService.getSession(userId, chatId);

        try {
            switch (session.state) {
                case SessionState.ASKING_DETAILS:
                    await this.processQuestionResponse(ctx, response);
                    break;
                case SessionState.CONFIRMING_TASK:
                    await this.processConfirmation(ctx, response);
                    break;
                default:
                    // Ignore responses when not in active session
                    break;
            }
        } catch (error) {
            this.logger.error('Error in handleResponse', error);
            await ctx.reply(
                "❌ Javobni qayta ishlashda xatolik yuz berdi. /cancel buyrug'i bilan bekor qiling.",
            );
        }
    }

    private async askNextQuestion(ctx: Context): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        const session = this.sessionService.getSession(userId, chatId);
        const questions = session.data.questions || [];
        const currentIndex = session.data.currentQuestionIndex || 0;

        if (currentIndex < questions.length) {
            const question = questions[currentIndex];

            await ctx.reply(
                `📝 **Vazifa ma'lumotlari (${currentIndex + 1}/${questions.length})**\n\n${question}\n\n💡 *Javob yuboring yoki /cancel tugmasini bosing.*`,
                { parse_mode: 'Markdown' },
            );
        } else {
            // All questions answered, show summary
            await this.showTaskSummary(ctx);
        }
    }

    private async processQuestionResponse(ctx: Context, response: string): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        const session = this.sessionService.getSession(userId, chatId);
        const currentIndex = session.data.currentQuestionIndex || 0;
        const questions = session.data.questions || [];

        // Process the response based on current question
        if (currentIndex === 0) {
            // First question - usually asking for more details
            if (response.length > 5) {
                this.sessionService.updateSessionData(userId, chatId, {
                    taskDescription: response,
                });
            }
        } else if (currentIndex === 1) {
            // Second question - usually about priority or timing
            const priority = this.extractPriorityFromResponse(response);
            const timeInfo = this.extractTimeFromResponse(response);

            const updates: any = {};
            if (priority) updates.priority = priority;
            if (timeInfo.estimatedTime) updates.estimatedTime = timeInfo.estimatedTime;
            if (timeInfo.deadline) updates.deadline = timeInfo.deadline;

            if (Object.keys(updates).length > 0) {
                this.sessionService.updateSessionData(userId, chatId, updates);
            }
        }

        // Move to next question
        this.sessionService.updateSessionData(userId, chatId, {
            currentQuestionIndex: currentIndex + 1,
            lastQuestionAnswer: response,
        });

        await this.askNextQuestion(ctx);
    }

    private async showTaskSummary(ctx: Context): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        const session = this.sessionService.getSession(userId, chatId);
        const { taskTitle, taskDescription, priority, estimatedTime, deadline } = session.data;

        const priorityEmoji = {
            [Priority.HIGH]: '🔥',
            [Priority.MEDIUM]: '🟡',
            [Priority.LOW]: '🟢',
        };

        let summaryText = `📋 **Vazifa Xulasasi:**\n\n`;
        summaryText += `📝 **Nomi:** ${taskTitle}\n`;
        summaryText += `📄 **Tavsif:** ${taskDescription || 'Tavsif kiritilmagan'}\n`;
        summaryText += `${priorityEmoji[priority || Priority.MEDIUM]} **Muhimligi:** ${priority || Priority.MEDIUM}\n`;
        summaryText += `⏱️ **Taxminiy vaqt:** ${estimatedTime || 60} daqiqa\n`;

        if (deadline) {
            summaryText += `📅 **Muddat:** ${deadline.toLocaleDateString('uz-UZ')}\n`;
        }

        summaryText += `\n✅ Vazifani yaratishni tasdiqlaysizmi?`;

        this.sessionService.updateSession(userId, chatId, {
            state: SessionState.CONFIRMING_TASK,
        });

        await ctx.reply(summaryText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Tasdiqlash', callback_data: 'confirm_task' },
                        { text: '✏️ Tahrirlash', callback_data: 'edit_task' },
                    ],
                    [{ text: '❌ Bekor qilish', callback_data: 'cancel_task' }],
                ],
            },
        });
    }

    private async processConfirmation(ctx: Context, response: string): Promise<void> {
        const lowercaseResponse = response.toLowerCase();

        if (
            lowercaseResponse.includes('ha') ||
            lowercaseResponse.includes('yes') ||
            lowercaseResponse.includes('tasdiqlash') ||
            lowercaseResponse.includes('ok')
        ) {
            await this.createFinalTask(ctx);
        } else {
            await ctx.reply(
                "❌ Vazifa yaratish bekor qilindi. Yangi vazifa qo'shish uchun /add buyrug'idan foydalaning.",
            );
            const userId = ctx.from?.id?.toString();
            const chatId = ctx.chat?.id;
            if (userId && chatId) {
                this.sessionService.clearSession(userId, chatId);
            }
        }
    }

    private async createTaskDirectly(
        ctx: Context,
        taskText: string,
        suggestedData: any,
    ): Promise<void> {
        const userId = ctx.from?.id?.toString();
        if (!userId) return;

        try {
            const taskData: TaskCreationData = {
                title: taskText,
                priority: suggestedData.priority || Priority.MEDIUM,
                estimatedTime: suggestedData.estimatedTime || 60,
                timezone: 'Asia/Tashkent',
            };

            const task = await this.tasksService.createTaskWithAISuggestions(
                userId,
                taskText,
                taskData.timezone || 'Asia/Tashkent',
            );

            const priorityEmoji = {
                [Priority.HIGH]: '🔥',
                [Priority.MEDIUM]: '🟡',
                [Priority.LOW]: '🟢',
            };

            let responseText = `✅ **Vazifa yaratildi!**\n\n`;
            responseText += `📝 ${task.title}\n`;
            responseText += `${priorityEmoji[task.priority]} ${task.priority}\n`;
            responseText += `⏱️ ${task.estimatedTime || 60} daqiqa\n`;

            if (task.deadline) {
                responseText += `📅 ${new Date(task.deadline).toLocaleDateString('uz-UZ')}`;
            } else {
                responseText += `📅 Muddat belgilanmagan`;
            }

            await ctx.reply(responseText, { parse_mode: 'Markdown' });
        } catch (error) {
            this.logger.error('Error in createTaskDirectly', error);
            await ctx.reply("❌ Vazifa yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
        }
    }

    private async createFinalTask(ctx: Context): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        try {
            const session = this.sessionService.getSession(userId, chatId);
            const { taskTitle, taskDescription, priority, estimatedTime, deadline } = session.data;

            const taskData: TaskCreationData = {
                title: taskTitle || 'Yangi vazifa',
                description: taskDescription,
                priority: priority || Priority.MEDIUM,
                estimatedTime: estimatedTime || 60,
                deadline: deadline,
                timezone: 'Asia/Tashkent',
            };

            const task = await this.tasksService.createTaskWithAISuggestions(
                userId,
                taskData.title,
                taskData.timezone || 'Asia/Tashkent',
            );

            const priorityEmoji = {
                [Priority.HIGH]: '🔥',
                [Priority.MEDIUM]: '🟡',
                [Priority.LOW]: '🟢',
            };

            let responseText = `✅ **Vazifa muvaffaqiyatli yaratildi!**\n\n`;
            responseText += `📝 ${task.title}\n`;
            if (task.description) {
                responseText += `📄 ${task.description}\n`;
            }
            responseText += `${priorityEmoji[task.priority]} ${task.priority}\n`;
            responseText += `⏱️ ${task.estimatedTime || 60} daqiqa\n`;

            if (task.deadline) {
                responseText += `📅 ${new Date(task.deadline).toLocaleDateString('uz-UZ')}`;
            } else {
                responseText += `📅 Muddat belgilanmagan`;
            }

            await ctx.reply(responseText, { parse_mode: 'Markdown' });

            // Clear session
            this.sessionService.clearSession(userId, chatId);
        } catch (error) {
            this.logger.error('Error in createFinalTask', error);
            await ctx.reply("❌ Vazifa yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
            this.sessionService.clearSession(userId, chatId);
        }
    }

    private extractPriorityFromResponse(response: string): Priority | null {
        const text = response.toLowerCase();

        if (
            text.includes('yuqori') ||
            text.includes('muhim') ||
            text.includes('urgent') ||
            text.includes('high') ||
            text.includes('shoshilinch') ||
            text.includes('zarur')
        ) {
            return Priority.HIGH;
        }
        if (
            text.includes('past') ||
            text.includes('oddiy') ||
            text.includes('low') ||
            text.includes('keyinroq') ||
            text.includes('routine')
        ) {
            return Priority.LOW;
        }
        if (text.includes("o'rta") || text.includes('medium') || text.includes('normal')) {
            return Priority.MEDIUM;
        }

        return null;
    }

    private extractTimeFromResponse(response: string): { estimatedTime?: number; deadline?: Date } {
        const result: { estimatedTime?: number; deadline?: Date } = {};
        const text = response.toLowerCase();

        // Extract estimated time
        const timeMatch = text.match(/(\d+)\s*(daqiqa|minut|soat|hour)/);
        if (timeMatch) {
            const value = parseInt(timeMatch[1]);
            const unit = timeMatch[2];

            if (unit.includes('soat') || unit.includes('hour')) {
                result.estimatedTime = value * 60;
            } else {
                result.estimatedTime = value;
            }
        }

        // Extract deadline keywords
        const now = new Date();
        if (text.includes('bugun') || text.includes('today')) {
            result.deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else if (text.includes('ertaga') || text.includes('tomorrow')) {
            result.deadline = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        } else if (text.includes('hafta') || text.includes('week')) {
            result.deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        return result;
    }

    async handleCancel(ctx: Context): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        const session = this.sessionService.getSession(userId, chatId);

        if (session.state !== SessionState.IDLE) {
            this.sessionService.clearSession(userId, chatId);
            await ctx.reply('❌ Vazifa yaratish bekor qilindi.');
        } else {
            await ctx.reply("Hech qanday aktiv jarayon yo'q.");
        }
    }

    async handleCallbackQuery(ctx: Context, data: string): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        try {
            switch (data) {
                case 'confirm_task':
                    await this.createFinalTask(ctx);
                    break;
                case 'cancel_task':
                    await this.handleCancel(ctx);
                    await ctx.editMessageText('❌ Vazifa yaratish bekor qilindi.');
                    break;
                case 'edit_task':
                    // Restart the question process
                    this.sessionService.updateSessionData(userId, chatId, {
                        currentQuestionIndex: 0,
                    });
                    this.sessionService.updateSession(userId, chatId, {
                        state: SessionState.ASKING_DETAILS,
                    });

                    await ctx.editMessageText('✏️ Qaytadan tahrirlash...');
                    await this.askNextQuestion(ctx);
                    break;
            }
        } catch (error) {
            this.logger.error('Error in handleCallbackQuery', error);
            await ctx.reply("❌ Xatolik yuz berdi. Qayta urinib ko'ring.");
        }
    }

    async handleTaskConfirmation(ctx: Context): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        const session = this.sessionService.getSession(userId, chatId);

        if (session.state === SessionState.CONFIRMING_TASK) {
            await this.createFinalTask(ctx);
        }
    }

    async handleTaskEdit(ctx: Context): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        const session = this.sessionService.getSession(userId, chatId);

        // Reset to asking details state and restart questions
        this.sessionService.updateSession(userId, chatId, {
            state: SessionState.ASKING_DETAILS,
            data: {
                ...session.data,
                currentQuestionIndex: 0,
            },
        });

        await ctx.editMessageText('✏️ Vazifani qayta tahrirlash...');

        // Ask the first question again
        const updatedSession = this.sessionService.getSession(userId, chatId);
        await this.askNextQuestion(ctx);
    }

    async handleUserResponse(ctx: Context, response: string): Promise<void> {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) return;

        const session = this.sessionService.getSession(userId, chatId);

        if (session.state === SessionState.ASKING_DETAILS) {
            await this.processQuestionResponse(ctx, response);
        } else if (session.state === SessionState.CONFIRMING_TASK) {
            await this.processConfirmation(ctx, response);
        }
    }
}

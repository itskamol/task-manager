import { Conversation, ConversationFlavor, createConversation } from '@grammyjs/conversations';
import { Context } from 'grammy';
import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { TasksService } from '../../tasks/tasks.service';
import { SessionService } from '../services/session.service';
import { BotLoggerService } from '../services/bot-logger.service';
import { LoggerService } from '../../common/services/logger.service';
import { Priority } from '@prisma/client';
import { SessionState } from '../interfaces/session.interface';

export type MyContext = Context & ConversationFlavor<Context>;
export type MyConversation = Conversation<MyContext>;

@Injectable()
export class ConversationHandlers {
    constructor(
        private readonly aiService: AiService,
        private readonly tasksService: TasksService,
        private readonly sessionService: SessionService,
        private readonly botLogger: BotLoggerService,
        private readonly logger: LoggerService,
    ) {}

    /**
     * Get the conversation middleware for task creation
     */
    get createTaskConversation() {
        return createConversation(async (conversation: MyConversation, ctx: MyContext) => {
            return await this.handleTaskCreation(conversation, ctx);
        }, 'createTaskConversation');
    }

    /**
     * Main conversation handler for creating tasks through natural language
     */
    private async handleTaskCreation(conversation: MyConversation, ctx: MyContext) {
        const userId = ctx.from?.id?.toString();
        const chatId = ctx.chat?.id;

        if (!userId || !chatId) {
            await ctx.reply("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
            return;
        }

        this.botLogger.messageReceived(ctx);
        this.logger.info('Starting task creation conversation', {
            userId,
            chatId,
            context: 'ConversationHandlers',
        });

        try {
            // Initialize session
            const session = this.sessionService.updateSession(userId, chatId, {
                state: SessionState.CREATING_TASK,
                data: {},
            });

            // Get initial message or prompt for task details
            let taskText = ctx.message?.text || '';

            if (!taskText || taskText.startsWith('/create_task')) {
                await ctx.reply(
                    '📝 Yangi vazifa yaratamiz!\n\n' +
                        'Vazifangizni tavsiflab bering. Masalan:\n' +
                        "• 'Ertaga soat 3da Alisher bilan uchrashish'\n" +
                        "• 'Hafta oxirigacha loyiha taqdimotini tayyorlash'\n" +
                        "• 'Non va sut sotib olish'",
                );

                const response = await conversation.wait();
                taskText = response.message?.text || '';

                if (!taskText) {
                    await ctx.reply('❌ Vazifa matni kiritilmadi. Bekor qilindi.');
                    return;
                }
            }

            // Use AI to understand user intent
            const intentResult = await this.aiService.understandUserIntent(taskText, userId);

            this.logger.debug('Intent analysis result', {
                intent: intentResult.intent,
                isComplete: intentResult.isComplete,
                hasQuestions: intentResult.clarificationQuestions
                    ? intentResult.clarificationQuestions.length > 0
                    : false,
            });

            // Handle different intents
            if (intentResult.intent === 'CHITCHAT') {
                await ctx.reply(
                    '😊 Rahmat! Lekin vazifa yaratish uchun konkret ish haqida ayting.',
                );
                return;
            }

            if (intentResult.intent === 'UNKNOWN') {
                await ctx.reply(
                    "🤔 Kechirasiz, tushunmadim. Vazifa yaratish uchun qilmoqchi bo'lgan ishingizni aniq aytib bering.\n\n" +
                        "Masalan: 'Kitob o'qish', 'Dukturga borish', 'Loyiha tugallash'",
                );
                return;
            }

            // Store extracted entities
            this.sessionService.updateSession(userId, chatId, {
                data: {
                    ...session.data,
                    taskTitle: intentResult.entities.actionPhrase || taskText,
                    deadline: intentResult.entities.remindAt
                        ? new Date(intentResult.entities.remindAt)
                        : undefined,
                },
            });

            // Handle incomplete information - ask clarification questions
            if (
                !intentResult.isComplete &&
                intentResult.clarificationQuestions &&
                intentResult.clarificationQuestions.length > 0
            ) {
                await this.handleClarificationQuestions(
                    conversation,
                    ctx,
                    intentResult.clarificationQuestions,
                    userId,
                    chatId,
                );
            }

            // Analyze task for additional suggestions
            const analysisResult = await this.aiService.analyzeTaskAndGenerateQuestions(
                intentResult.entities.actionPhrase || taskText,
            );

            // Ask additional questions if needed
            if (analysisResult.needsMoreInfo && analysisResult.questions.length > 0) {
                await this.askAdditionalQuestions(
                    conversation,
                    ctx,
                    analysisResult.questions,
                    userId,
                    chatId,
                );
            }

            // Get final session data
            const finalSession = this.sessionService.getSession(userId, chatId);

            // Set suggested data if not provided
            if (!finalSession.data.priority) {
                finalSession.data.priority = analysisResult.suggestedData.priority;
            }
            if (!finalSession.data.estimatedTime && analysisResult.suggestedData.estimatedTime) {
                finalSession.data.estimatedTime = analysisResult.suggestedData.estimatedTime;
            }

            // Create task confirmation
            await this.confirmTaskCreation(conversation, ctx, userId, chatId);
        } catch (error) {
            this.logger.error('Error in task creation conversation', error, {
                context: 'ConversationHandlers',
                userId,
                chatId,
            });
            await ctx.reply(
                "❌ Xatolik yuz berdi. Iltimos, /start buyrug'i bilan qayta urinib ko'ring.",
            );
        }
    }

    /**
     * Handle clarification questions for incomplete user input
     */
    private async handleClarificationQuestions(
        conversation: MyConversation,
        ctx: MyContext,
        questions: string[],
        userId: string,
        chatId: number,
    ) {
        for (const question of questions) {
            await ctx.reply(`❓ ${question}`);

            const response = await conversation.wait();
            const answerText = response.message?.text;

            if (!answerText) {
                await ctx.reply("⚠️ Javob berilmadi, keyingisiga o'tamiz...");
                continue;
            }

            // Analyze the answer to extract relevant information
            const answerIntent = await this.aiService.understandUserIntent(answerText, userId);

            // Update session with new information
            const currentSession = this.sessionService.getSession(userId, chatId);
            const updatedData = { ...currentSession.data };

            // Extract deadline information
            if (answerIntent.entities.remindAt) {
                updatedData.deadline = new Date(answerIntent.entities.remindAt);
            }

            // Extract description or additional details
            if (answerIntent.entities.actionPhrase && !updatedData.taskDescription) {
                updatedData.taskDescription = answerIntent.entities.actionPhrase;
            }

            this.sessionService.updateSession(userId, chatId, {
                data: updatedData,
            });
        }
    }

    /**
     * Ask additional questions for task optimization
     */
    private async askAdditionalQuestions(
        conversation: MyConversation,
        ctx: MyContext,
        questions: string[],
        userId: string,
        chatId: number,
    ) {
        await ctx.reply('📋 Vazifani yanada yaxshiroq tashkil qilish uchun bir nechta savol:');

        for (const question of questions) {
            await ctx.reply(`🔹 ${question}\n\n(Bilmasangiz, "o'tkazib yuborish" deb yozing)`);

            const response = await conversation.wait();
            const answerText = response.message?.text?.toLowerCase();

            if (
                !answerText ||
                answerText.includes("o'tkazib") ||
                answerText.includes('bilmayman')
            ) {
                continue;
            }

            // Process the answer
            const currentSession = this.sessionService.getSession(userId, chatId);
            const updatedData = { ...currentSession.data };

            // Try to extract useful information from the answer
            if (
                question.toLowerCase().includes('muhim') ||
                question.toLowerCase().includes('prioritet')
            ) {
                // Priority question
                if (answerText.includes('muhim') || answerText.includes('zudlik')) {
                    updatedData.priority = Priority.HIGH;
                } else if (answerText.includes('oddiy') || answerText.includes('sekin')) {
                    updatedData.priority = Priority.LOW;
                } else {
                    updatedData.priority = Priority.MEDIUM;
                }
            } else if (
                question.toLowerCase().includes('vaqt') ||
                question.toLowerCase().includes('davom')
            ) {
                // Time estimation question
                const timeMatch = answerText.match(/(\d+)\s*(soat|minut|kun)/);
                if (timeMatch) {
                    const [, number, unit] = timeMatch;
                    let minutes = parseInt(number);
                    if (unit === 'soat') minutes *= 60;
                    if (unit === 'kun') minutes *= 60 * 24;
                    updatedData.estimatedTime = minutes;
                }
            } else {
                // General description update
                if (!updatedData.taskDescription) {
                    updatedData.taskDescription = answerText;
                } else {
                    updatedData.taskDescription += `. ${answerText}`;
                }
            }

            this.sessionService.updateSession(userId, chatId, {
                data: updatedData,
            });
        }
    }

    /**
     * Confirm task creation with user
     */
    private async confirmTaskCreation(
        conversation: MyConversation,
        ctx: MyContext,
        userId: string,
        chatId: number,
    ) {
        const session = this.sessionService.getSession(userId, chatId);
        const { taskTitle, taskDescription, priority, estimatedTime, deadline } = session.data;

        if (!taskTitle) {
            await ctx.reply("❌ Vazifa nomi aniqlanmadi. Iltimos, qayta urinib ko'ring.");
            return;
        }

        // Format confirmation message
        let confirmationText = `✅ Vazifa tayyor!\n\n`;
        confirmationText += `📝 **Nomi:** ${taskTitle}\n`;

        if (taskDescription) {
            confirmationText += `📄 **Tavsif:** ${taskDescription}\n`;
        }

        if (priority) {
            const priorityText = {
                [Priority.LOW]: '🟢 Past',
                [Priority.MEDIUM]: "🟡 O'rta",
                [Priority.HIGH]: '🔴 Yuqori',
            }[priority];
            confirmationText += `⚡ **Muhimlik:** ${priorityText}\n`;
        }

        if (estimatedTime) {
            const hours = Math.floor(estimatedTime / 60);
            const minutes = estimatedTime % 60;
            let timeText = '';
            if (hours > 0) timeText += `${hours} soat `;
            if (minutes > 0) timeText += `${minutes} minut`;
            confirmationText += `⏱️ **Vaqt:** ${timeText}\n`;
        }

        if (deadline) {
            confirmationText += `📅 **Muddat:** ${deadline.toLocaleDateString('uz-UZ')} ${deadline.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n`;
        }

        confirmationText += `\n❓ Vazifani yaratamizmi?`;

        await ctx.reply(confirmationText, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Ha, yaratish', callback_data: `confirm_task_${userId}` },
                        { text: '❌ Bekor qilish', callback_data: `cancel_task_${userId}` },
                    ],
                    [{ text: '✏️ Tahrirlash', callback_data: `edit_task_${userId}` }],
                ],
            },
        });

        // Wait for callback query
        const callbackCtx = await conversation.waitForCallbackQuery(/^(confirm|cancel|edit)_task_/);

        if (callbackCtx.callbackQuery.data.startsWith('confirm_task')) {
            await this.createFinalTask(ctx, userId, chatId);
        } else if (callbackCtx.callbackQuery.data.startsWith('cancel_task')) {
            await callbackCtx.editMessageText('❌ Vazifa yaratish bekor qilindi.');
            await callbackCtx.answerCallbackQuery();
        } else if (callbackCtx.callbackQuery.data.startsWith('edit_task')) {
            await this.handleTaskEditing(conversation, ctx, userId, chatId);
        }
    }

    /**
     * Create the final task in the database
     */
    private async createFinalTask(ctx: MyContext, userId: string, chatId: number) {
        try {
            const session = this.sessionService.getSession(userId, chatId);
            const { taskTitle, taskDescription, priority, estimatedTime, deadline } = session.data;

            const task = await this.tasksService.createTask(userId, {
                title: taskTitle!,
                description: taskDescription,
                priority: priority || Priority.MEDIUM,
                estimatedTime,
                deadline,
            });

            await ctx.editMessageText(
                `🎉 Vazifa muvaffaqiyatli yaratildi!\n\n` +
                    `📝 ${task.title}\n` +
                    `🆔 ID: ${task.id}\n\n` +
                    `Vazifalaringizni ko'rish uchun /list buyrug'idan foydalaning.`,
            );

            // Clear session
            this.sessionService.updateSession(userId, chatId, {
                state: SessionState.IDLE,
                data: {},
            });

            this.logger.info('Task created successfully via conversation', {
                taskId: task.id,
                userId,
                context: 'ConversationHandlers',
            });
        } catch (error) {
            this.logger.error('Failed to create task', error, {
                context: 'ConversationHandlers',
                userId,
            });
            await ctx.editMessageText(
                "❌ Vazifa yaratishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
            );
        }

        await ctx.answerCallbackQuery();
    }

    /**
     * Handle task editing
     */
    private async handleTaskEditing(
        conversation: MyConversation,
        ctx: MyContext,
        userId: string,
        chatId: number,
    ) {
        await ctx.editMessageText("✏️ Qaysi qismini o'zgartirmoqchisiz?", {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📝 Nomi', callback_data: `edit_title_${userId}` },
                        { text: '📄 Tavsif', callback_data: `edit_description_${userId}` },
                    ],
                    [
                        { text: '⚡ Muhimlik', callback_data: `edit_priority_${userId}` },
                        { text: '⏱️ Vaqt', callback_data: `edit_time_${userId}` },
                    ],
                    [{ text: '📅 Muddat', callback_data: `edit_deadline_${userId}` }],
                    [{ text: '⬅️ Orqaga', callback_data: `back_to_confirm_${userId}` }],
                ],
            },
        });

        await ctx.answerCallbackQuery();

        // Wait for edit choice
        const editChoice = await conversation.waitForCallbackQuery(/^edit_|^back_to_confirm_/);
        const action = editChoice.callbackQuery.data;

        if (action.startsWith('back_to_confirm')) {
            await this.confirmTaskCreation(conversation, ctx, userId, chatId);
            return;
        }

        // Handle specific edits
        await this.handleSpecificEdit(conversation, ctx, action, userId, chatId);
    }

    /**
     * Handle specific field editing
     */
    private async handleSpecificEdit(
        conversation: MyConversation,
        ctx: MyContext,
        action: string,
        userId: string,
        chatId: number,
    ) {
        await ctx.answerCallbackQuery();

        if (action.includes('edit_title')) {
            await ctx.editMessageText('📝 Yangi vazifa nomini kiriting:');
            const response = await conversation.wait();
            const newTitle = response.message?.text;

            if (newTitle) {
                this.sessionService.updateSession(userId, chatId, {
                    data: { taskTitle: newTitle },
                });
                await ctx.reply('✅ Vazifa nomi yangilandi!');
            }
        } else if (action.includes('edit_description')) {
            await ctx.editMessageText('📄 Yangi tavsifni kiriting:');
            const response = await conversation.wait();
            const newDescription = response.message?.text;

            if (newDescription) {
                this.sessionService.updateSession(userId, chatId, {
                    data: { taskDescription: newDescription },
                });
                await ctx.reply('✅ Tavsif yangilandi!');
            }
        } else if (action.includes('edit_priority')) {
            await ctx.editMessageText('⚡ Muhimlik darajasini tanlang:', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🟢 Past', callback_data: `priority_low_${userId}` },
                            { text: "🟡 O'rta", callback_data: `priority_medium_${userId}` },
                            { text: '🔴 Yuqori', callback_data: `priority_high_${userId}` },
                        ],
                    ],
                },
            });

            const priorityChoice = await conversation.waitForCallbackQuery(/^priority_/);
            const priorityAction = priorityChoice.callbackQuery.data;

            let priority: Priority = Priority.MEDIUM;
            if (priorityAction.includes('low')) priority = Priority.LOW;
            if (priorityAction.includes('high')) priority = Priority.HIGH;

            this.sessionService.updateSession(userId, chatId, {
                data: { priority },
            });

            await priorityChoice.editMessageText('✅ Muhimlik darajasi yangilandi!');
            await priorityChoice.answerCallbackQuery();
        }

        // Return to confirmation
        setTimeout(async () => {
            await this.confirmTaskCreation(conversation, ctx, userId, chatId);
        }, 1000);
    }
}

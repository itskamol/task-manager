import { Injectable } from '@nestjs/common';
import { Bot } from 'grammy';
import { AiService } from '../../ai/ai.service';
import { SessionService } from '../services/session.service';
import { BotLoggerService } from '../services/bot-logger.service';
import { LoggerService } from '../../common/services/logger.service';
import { TasksService } from '../../tasks/tasks.service';
import { MyContext } from './conversation.handler';
import { SessionState } from '../interfaces/session.interface';

@Injectable()
export class MessageHandler {
    constructor(
        private readonly aiService: AiService,
        private readonly sessionService: SessionService,
        private readonly botLogger: BotLoggerService,
        private readonly logger: LoggerService,
        private readonly tasksService: TasksService,
    ) {}

    /**
     * Setup text message handling for natural language processing
     */
    setupTextMessageHandler(bot: Bot) {
        // Handle all text messages that are not commands
        bot.on('message:text', async (ctx) => {
            const messageText = ctx.message?.text;
            const userId = ctx.from?.id?.toString();
            const chatId = ctx.chat?.id;

            // Skip if it's a command (starts with /) or no message text
            if (!messageText || messageText.startsWith('/')) {
                return;
            }

            if (!userId || !chatId) {
                await ctx.reply("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
                return;
            }

            this.botLogger.messageReceived(ctx);
            this.logger.debug('Processing natural language message', {
                userId,
                chatId,
                messageLength: messageText.length,
                context: 'MessageHandler',
            });

            try {
                // Get user's current session
                const session = this.sessionService.getSession(userId, chatId);

                // If user is already in a conversation, let the conversation handle it
                if (session.state !== SessionState.IDLE) {
                    this.logger.debug('User is in active conversation, skipping message handler', {
                        userId,
                        currentState: session.state,
                    });
                    return;
                }

                // Use AI to understand user intent
                const intentResult = await this.aiService.understandUserIntent(messageText, userId);

                this.logger.debug('Message intent analyzed', {
                    intent: intentResult.intent,
                    isComplete: intentResult.isComplete,
                    hasEntities: Object.keys(intentResult.entities).length > 0,
                    userId,
                });

                // Route based on intent
                await this.routeIntent(ctx, intentResult, userId, chatId, messageText);
            } catch (error) {
                this.logger.error('Error processing text message', error, {
                    context: 'MessageHandler',
                    userId,
                    chatId,
                });
                await ctx.reply(
                    '❌ Xabarni qayta ishlashda xatolik yuz berdi.\n\n' +
                        "Buyruqlar ro'yxati uchun /help buyrug'idan foydalaning.",
                );
            }
        });
    }

    /**
     * Route user intent to appropriate action
     */
    private async routeIntent(
        ctx: any,
        intentResult: any,
        userId: string,
        chatId: number,
        originalMessage: string,
    ) {
        switch (intentResult.intent) {
            case 'CREATE_TASK':
                await this.handleCreateTaskIntent(
                    ctx,
                    intentResult,
                    userId,
                    chatId,
                    originalMessage,
                );
                break;

            case 'CREATE_REMINDER':
                await this.handleCreateReminderIntent(
                    ctx,
                    intentResult,
                    userId,
                    chatId,
                    originalMessage,
                );
                break;

            case 'LIST_TASKS':
                await this.handleListTasksIntent(ctx, userId);
                break;

            case 'CHITCHAT':
                await this.handleChitchatIntent(ctx, intentResult, originalMessage);
                break;

            case 'UNKNOWN':
            default:
                await this.handleUnknownIntent(ctx, intentResult);
                break;
        }
    }

    /**
     * Handle CREATE_TASK intent
     */
    private async handleCreateTaskIntent(
        ctx: any,
        intentResult: any,
        userId: string,
        chatId: number,
        originalMessage: string,
    ) {
        // Check if we have enough information to create task directly
        if (intentResult.isComplete && intentResult.entities.actionPhrase) {
            // Try quick task creation
            await this.attemptQuickTaskCreation(ctx, intentResult, userId);
        } else {
            // Start conversation for detailed task creation
            await ctx.reply(
                "📝 Vazifa yaratish uchun batafsil ma'lumot kerak.\n" +
                    "Suhbatni boshlash uchun /create_task buyrug'idan foydalaning yoki quyidagi tugmani bosing:",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '📝 Vazifa yaratish',
                                    callback_data: `start_task_conversation_${userId}`,
                                },
                            ],
                        ],
                    },
                },
            );
        }
    }

    /**
     * Handle CREATE_REMINDER intent
     */
    private async handleCreateReminderIntent(
        ctx: any,
        intentResult: any,
        userId: string,
        chatId: number,
        originalMessage: string,
    ) {
        if (
            intentResult.isComplete &&
            intentResult.entities.actionPhrase &&
            intentResult.entities.remindAt
        ) {
            // Create reminder directly
            await this.createQuickReminder(ctx, intentResult, userId);
        } else {
            // Ask for clarification
            let message = "⏰ Eslatma yaratish uchun quyidagi ma'lumotlar kerak:\n\n";

            if (!intentResult.entities.actionPhrase) {
                message += '❓ Nimani eslatish kerak?\n';
            }

            if (!intentResult.entities.remindAt) {
                message += '❓ Qachon eslatish kerak? (sanani va vaqtni kiriting)\n';
            }

            if (
                intentResult.clarificationQuestions &&
                intentResult.clarificationQuestions.length > 0
            ) {
                message += '\n' + intentResult.clarificationQuestions.join('\n');
            }

            await ctx.reply(message);
        }
    }

    /**
     * Handle LIST_TASKS intent
     */
    private async handleListTasksIntent(ctx: any, userId: string) {
        try {
            const tasks = await this.tasksService.getUserTasks(userId);

            // Filter for pending tasks and limit to 10
            const pendingTasks = tasks.filter((task) => task.status === 'PENDING').slice(0, 10);

            if (pendingTasks.length === 0) {
                await ctx.reply(
                    "📋 Sizda hozirda bajarilmagan vazifalar yo'q.\n\n" +
                        "Yangi vazifa yaratish uchun /create_task buyrug'idan foydalaning.",
                );
                return;
            }

            let message = '📋 **Sizning vazifalaringiz:**\n\n';

            pendingTasks.forEach((task, index) => {
                const priorityEmoji = {
                    LOW: '🟢',
                    MEDIUM: '🟡',
                    HIGH: '🔴',
                }[task.priority];

                message += `${index + 1}. ${priorityEmoji} ${task.title}\n`;

                if (task.deadline) {
                    const deadline = new Date(task.deadline);
                    message += `   📅 ${deadline.toLocaleDateString('uz-UZ')} ${deadline.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n`;
                }

                message += '\n';
            });

            message += "To'liq ro'yxat uchun /list buyrug'idan foydalaning.";

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            this.logger.error('Failed to fetch user tasks', error, {
                context: 'MessageHandler',
                userId,
            });
            await ctx.reply('❌ Vazifalarni yuklashda xatolik yuz berdi.');
        }
    }

    /**
     * Handle CHITCHAT intent
     */
    private async handleChitchatIntent(ctx: any, intentResult: any, originalMessage: string) {
        const responses = [
            '😊 Salom! Men sizning vazifalaringizni boshqarishga yordam beraman.',
            '👋 Salom! Bugun qanday vazifalar bilan yordam kerak?',
            "🤖 Salom! Vazifa yaratish, ro'yxat ko'rish yoki hisobot olish uchun buyruqlardan foydalaning.",
            "😃 Assalomu alaykum! /help buyrug'i bilan nima qila olishimni bilib oling.",
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        await ctx.reply(randomResponse);
    }

    /**
     * Handle UNKNOWN intent
     */
    private async handleUnknownIntent(ctx: any, intentResult: any) {
        let response = '🤔 Kechirasiz, nima qilmoqchi ekanligingizni tushunmadim.\n\n';

        if (intentResult.clarificationQuestions && intentResult.clarificationQuestions.length > 0) {
            response += intentResult.clarificationQuestions.join('\n') + '\n\n';
        }

        response += 'Quyidagi buyruqlardan foydalanishingiz mumkin:\n';
        response += '• /create_task - Yangi vazifa yaratish\n';
        response += "• /list - Vazifalar ro'yxati\n";
        response += '• /help - Barcha buyruqlar\n\n';
        response += "Yoki shunchaki 'kitob o\'qish kerak' kabi oddiy til bilan yozing.";

        await ctx.reply(response);
    }

    /**
     * Attempt to create a task quickly with provided information
     */
    private async attemptQuickTaskCreation(ctx: any, intentResult: any, userId: string) {
        try {
            // Analyze the task for additional suggestions
            const analysisResult = await this.aiService.analyzeTaskAndGenerateQuestions(
                intentResult.entities.actionPhrase,
            );

            const taskData = {
                title: intentResult.entities.actionPhrase,
                description: intentResult.entities.description,
                priority: analysisResult.suggestedData.priority,
                estimatedTime: analysisResult.suggestedData.estimatedTime || undefined,
                deadline: intentResult.entities.remindAt
                    ? new Date(intentResult.entities.remindAt)
                    : undefined,
            };

            const task = await this.tasksService.createTask(userId, taskData);

            let message = `✅ Vazifa yaratildi!\n\n`;
            message += `📝 **${task.title}**\n`;
            message += `🆔 ID: ${task.id}\n`;

            if (task.deadline) {
                message += `📅 Muddat: ${task.deadline.toLocaleDateString('uz-UZ')} ${task.deadline.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n`;
            }

            message += `\nVazifangiz muvaffaqiyatli qo'shildi! 🎉`;

            await ctx.reply(message, { parse_mode: 'Markdown' });

            this.logger.info('Quick task created successfully', {
                taskId: task.id,
                userId,
                context: 'MessageHandler',
            });
        } catch (error) {
            this.logger.error('Failed to create quick task', error, {
                context: 'MessageHandler',
                userId,
            });
            await ctx.reply(
                '❌ Vazifa yaratishda xatolik yuz berdi.\n' +
                    "Batafsil yaratish uchun /create_task buyrug'idan foydalaning.",
            );
        }
    }

    /**
     * Create a quick reminder
     */
    private async createQuickReminder(ctx: any, intentResult: any, userId: string) {
        try {
            const reminderData = {
                title: `Eslatma: ${intentResult.entities.actionPhrase}`,
                description: `Eslatma vaqti: ${intentResult.entities.remindAt}`,
                deadline: new Date(intentResult.entities.remindAt),
                priority: 'MEDIUM' as any,
            };

            const reminder = await this.tasksService.createTask(userId, reminderData);

            await ctx.reply(
                `⏰ Eslatma yaratildi!\n\n` +
                    `📝 ${reminder.title}\n` +
                    `📅 Vaqt: ${reminder.deadline?.toLocaleDateString('uz-UZ')} ${reminder.deadline?.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n\n` +
                    `Eslatma ID: ${reminder.id} ✅`,
            );
        } catch (error) {
            this.logger.error('Failed to create quick reminder', error, {
                context: 'MessageHandler',
                userId,
            });
            await ctx.reply('❌ Eslatma yaratishda xatolik yuz berdi.');
        }
    }
}

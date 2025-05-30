import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { conversations, ConversationFlavor } from '@grammyjs/conversations';
import { BotLoggerService } from './bot-logger.service';
import { BotCommandRegistryService } from './bot-command-registry.service';
import { LoggerService } from '../../common/services/logger.service';
import { ConversationHandlers, MyContext } from '../handlers/conversation.handler';
import { MessageHandler } from '../handlers/message.handler';

@Injectable()
export class BotService implements OnModuleInit, OnApplicationShutdown {
    private readonly bot: Bot<MyContext>;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: BotLoggerService,
        private readonly commandRegistryService: BotCommandRegistryService,
        private readonly appLogger: LoggerService,
        private readonly conversationHandlers: ConversationHandlers,
        private readonly messageHandler: MessageHandler,
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

        if (!token) {
            this.logger.botError(undefined, new Error('TELEGRAM_BOT_TOKEN is not defined'));
            this.appLogger.error('TELEGRAM_BOT_TOKEN is not configured', undefined, {
                context: 'BotService',
                severity: 'high',
            });
            throw new Error('TELEGRAM_BOT_TOKEN is not defined');
        }

        this.bot = new Bot<MyContext>(token);
        this.setupConversations();
        this.setupErrorHandling();
        this.setupMetricsTracking();
    }

    private setupErrorHandling(): void {
        this.bot.catch((err) => {
            this.logger.botError(undefined, err);
            this.appLogger.error('Bot error occurred', err, {
                context: 'BotService',
                severity: 'medium',
            });
        });
    }

    private setupMetricsTracking(): void {
        // Track all incoming updates
        this.bot.use(async (ctx, next) => {
            const startTime = Date.now();

            try {
                await next();
                const duration = Date.now() - startTime;

                // Log successful bot interaction
                this.appLogger.debug('Bot update processed', {
                    type: ctx.update.message
                        ? 'message'
                        : ctx.update.callback_query
                          ? 'callback'
                          : 'command',
                    userId: ctx.from?.id,
                    username: ctx.from?.username,
                    chatId: ctx.chat?.id,
                    updateType: ctx.update.update_id ? 'update_id' : 'unknown',
                    command: ctx.message?.text?.startsWith('/')
                        ? ctx.message.text.split(' ')[0]
                        : undefined,
                    duration,
                });
            } catch (error) {
                const duration = Date.now() - startTime;

                this.appLogger.error('Bot update processing failed', error, {
                    context: 'BotService',
                    duration,
                    updateType: ctx.update?.update_id ? 'update_id' : 'unknown',
                });

                throw error;
            }
        });
    }

    private setupConversations(): void {
        // Install conversations plugin
        this.bot.use(conversations());

        // Register named conversations
        this.bot.use(this.conversationHandlers.createTaskConversation);

        // Setup message handler for natural language processing
        this.messageHandler.setupTextMessageHandler(this.bot);

        // Setup callback handlers for conversation triggers
        this.setupConversationTriggers();
    }

    private setupConversationTriggers(): void {
        // Handle callback queries for starting conversations
        this.bot.callbackQuery(/^start_task_conversation_/, async (ctx) => {
            await ctx.answerCallbackQuery();
            await ctx.conversation.enter('createTaskConversation');
        });

        // Handle /create_task command to start conversation
        this.bot.command('create_task', async (ctx) => {
            await ctx.conversation.enter('createTaskConversation');
        });
    }

    async onModuleInit(): Promise<void> {
        try {
            // Setup command handlers first
            this.commandRegistryService.setupHandlers(this.bot);

            // Register visible commands with Telegram
            await this.commandRegistryService.registerCommands(this.bot);

            // Start the bot
            await this.bot.start({
                onStart: () => this.appLogger.info('Bot started', { context: 'BotService' }),
            });
        } catch (error) {
            this.appLogger.error('Failed to initialize bot', error, { context: 'BotService' });
            throw error;
        }
    }

    async onApplicationShutdown(): Promise<void> {
        try {
            await this.bot.stop();
            this.appLogger.info('Bot stopped', { context: 'BotService' });
        } catch (error) {
            this.appLogger.error('Failed to stop bot', error, { context: 'BotService' });
        }
    }
}

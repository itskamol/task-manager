import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { BotLoggerService } from './bot-logger.service';
import { BotCommandRegistryService } from './bot-command-registry.service';
import { LoggerService } from '../../common/services/logger.service';

@Injectable()
export class BotService implements OnModuleInit, OnApplicationShutdown {
    private readonly bot: Bot;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: BotLoggerService,
        private readonly commandRegistryService: BotCommandRegistryService,
        private readonly appLogger: LoggerService,
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

        if (!token) {
            this.logger.botError(undefined, new Error('TELEGRAM_BOT_TOKEN is not defined'));
            this.appLogger.logSecurityEvent(
                'MISSING_BOT_TOKEN',
                {
                    error: 'TELEGRAM_BOT_TOKEN is not defined',
                    timestamp: new Date().toISOString(),
                },
                'high',
            );
            throw new Error('TELEGRAM_BOT_TOKEN is not defined');
        }

        this.bot = new Bot(token);
        this.setupErrorHandling();
        this.setupMetricsTracking();
    }

    private setupErrorHandling(): void {
        this.bot.catch((err) => {
            this.logger.botError(undefined, err);
            this.appLogger.logSecurityEvent(
                'BOT_ERROR',
                {
                    error: err.message,
                    stack: err.stack,
                    timestamp: new Date().toISOString(),
                },
                'medium',
            );
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
                this.appLogger.logBotInteraction(
                    ctx.update.message
                        ? 'message'
                        : ctx.update.callback_query
                          ? 'callback'
                          : 'command',
                    {
                        userId: ctx.from?.id,
                        username: ctx.from?.username,
                        chatId: ctx.chat?.id,
                        updateType: ctx.update.update_id ? 'update_id' : 'unknown',
                        command: ctx.message?.text?.startsWith('/')
                            ? ctx.message.text.split(' ')[0]
                            : undefined,
                    },
                );

                this.appLogger.logPerformance({
                    operation: 'BOT_UPDATE_PROCESSING',
                    duration,
                    context: 'TelegramBot',
                });
            } catch (error) {
                const duration = Date.now() - startTime;

                this.appLogger.logPerformance({
                    operation: 'BOT_UPDATE_PROCESSING',
                    duration,
                    context: 'TelegramBot',
                    metadata: { success: false, error: error.message },
                });

                throw error;
            }
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
                onStart: () => this.logger.botStarted(),
            });
        } catch (error) {
            this.logger.botError(undefined, error as Error);
            throw error;
        }
    }

    async onApplicationShutdown(): Promise<void> {
        try {
            await this.bot.stop();
            this.logger.botStopped();
        } catch (error) {
            this.logger.botError(undefined, error as Error);
        }
    }
}

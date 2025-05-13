import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { BotLoggerService } from './bot-logger.service';
import { StartHandler } from '../handlers/start.handler';
import { ContactHandler } from '../handlers/contact.handler';
import { TasksHandler } from '../../tasks/handlers/tasks.handler';
import { BotCommand } from '../../common/types/bot.types';

@Injectable()
export class BotService implements OnModuleInit, OnApplicationShutdown {
    private readonly bot: Bot;
    private readonly commands: BotCommand[];

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: BotLoggerService,
        private readonly startHandler: StartHandler,
        private readonly contactHandler: ContactHandler,
        private readonly tasksHandler: TasksHandler,
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

        if (!token) {
            this.logger.botError(undefined, new Error('TELEGRAM_BOT_TOKEN is not defined'));
            throw new Error('TELEGRAM_BOT_TOKEN is not defined');
        }

        this.bot = new Bot(token);
        this.commands = this.setupCommands();
        this.setupErrorHandling();
    }

    private setupCommands(): BotCommand[] {
        return [
            {
                command: 'start',
                description: 'Start using the task manager',
                handler: (ctx) => this.startHandler.handle(ctx),
            },
            {
                command: 'register',
                description: 'Register with phone number',
                handler: (ctx) => this.contactHandler.handle(ctx),
            },
            {
                command: 'add',
                description: 'Add a new task',
                handler: (ctx) => this.tasksHandler.handleAddTask(ctx),
            },
            {
                command: 'list',
                description: 'List all your tasks',
                handler: (ctx) => this.tasksHandler.handleListTasks(ctx),
            },
        ];
    }

    private setupErrorHandling(): void {
        this.bot.catch((err) => {
            this.logger.botError(undefined, err);
        });
    }

    private async registerCommands(): Promise<void> {
        try {
            const botCommands = this.commands.map(({ command, description }) => ({
                command,
                description,
            }));
            await this.bot.api.setMyCommands(botCommands);
            this.logger.info('Bot commands registered successfully');
        } catch (error) {
            this.logger.botError(undefined, error);
            throw error;
        }
    }

    private setupHandlers(): void {
        // Register command handlers
        this.commands.forEach(({ command, handler }) => {
            this.bot.command(command, async (ctx) => {
                if (ctx.message?.text) {
                    this.logger.commandReceived(ctx, ctx.message.text);
                }
                await handler(ctx);
            });
        });

        // Handle callback queries for consent response
        this.bot.callbackQuery(['agree_phone', 'decline_phone'], (ctx) => {
            this.logger.callbackReceived(ctx, ctx.callbackQuery.data);
            return this.contactHandler.handleConsentResponse(ctx);
        });

        // Handle contact messages for phone number registration
        this.bot.on('message:contact', (ctx) => {
            this.logger.messageReceived(ctx);
            return this.contactHandler.handle(ctx);
        });
    }

    async onModuleInit(): Promise<void> {
        try {
            this.setupHandlers();
            await this.registerCommands();
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

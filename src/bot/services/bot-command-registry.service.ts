import { Injectable } from '@nestjs/common';
import { Bot } from 'grammy';
import { BotCommand } from '../../common/types/bot.types';
import { StartHandler } from '../handlers/start.handler';
import { ContactHandler } from '../handlers/contact.handler';
import { TasksHandler } from '../../tasks/handlers/tasks.handler';
import { BotLoggerService } from './bot-logger.service';

@Injectable()
export class BotCommandRegistryService {
    private readonly commands: BotCommand[];

    constructor(
        private readonly logger: BotLoggerService,
        private readonly startHandler: StartHandler,
        private readonly contactHandler: ContactHandler,
        private readonly tasksHandler: TasksHandler,
    ) {
        this.commands = this.setupCommands();
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

    public async registerCommands(bot: Bot): Promise<void> {
        try {
            const botCommands = this.commands.map(({ command, description }) => ({
                command,
                description,
            }));
            await bot.api.setMyCommands(botCommands);
            this.logger.info('Bot commands registered successfully');
        } catch (error) {
            this.logger.botError(undefined, error);
            throw error;
        }
    }

    public setupHandlers(bot: Bot): void {
        // Register command handlers
        this.commands.forEach(({ command, handler }) => {
            bot.command(command, async (ctx) => {
                if (ctx.message?.text) {
                    this.logger.commandReceived(ctx, ctx.message.text);
                }
                await handler(ctx);
            });
        });

        // Handle callback queries for consent response
        // These are not strictly "commands", but they are part of the bot's interactive handlers.
        // It makes sense to keep them close to command handlers or move them to a more general "InteractionHandlerService" in the future.
        // For now, keeping them here as they were part of the original setupHandlers.
        bot.callbackQuery(['agree_phone', 'decline_phone'], (ctx) => {
            this.logger.callbackReceived(ctx, ctx.callbackQuery.data);
            return this.contactHandler.handleConsentResponse(ctx);
        });

        // Handle contact messages for phone number registration
        bot.on('message:contact', (ctx) => {
            this.logger.messageReceived(ctx);
            return this.contactHandler.handle(ctx);
        });
    }
}

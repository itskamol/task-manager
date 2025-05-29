import { Injectable } from '@nestjs/common';
import { Bot } from 'grammy';
import { BotCommand } from '../../common/types/bot.types';
import { StartHandler } from '../handlers/start.handler';
import { ContactHandler } from '../handlers/contact.handler';
import { HelpHandler } from '../handlers/help.handler';
import { TasksHandler } from '../../tasks/handlers/tasks.handler';
import { ReportsHandler } from '../../reports/handlers/reports.handler';
import { BotLoggerService } from './bot-logger.service';

@Injectable()
export class BotCommandRegistryService {
    private readonly commands: BotCommand[];

    constructor(
        private readonly logger: BotLoggerService,
        private readonly startHandler: StartHandler,
        private readonly contactHandler: ContactHandler,
        private readonly helpHandler: HelpHandler,
        private readonly tasksHandler: TasksHandler,
        private readonly reportsHandler: ReportsHandler,
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
            {
                command: 'daily_report',
                description: 'Get daily productivity report',
                handler: (ctx) => this.reportsHandler.handleDailyReport(ctx),
            },
            {
                command: 'weekly_report',
                description: 'Get weekly productivity report',
                handler: (ctx) => this.reportsHandler.handleWeeklyReport(ctx),
            },
            {
                command: 'monthly_report',
                description: 'Get monthly productivity report',
                handler: (ctx) => this.reportsHandler.handleMonthlyReport(ctx),
            },
            {
                command: 'quarterly_report',
                description: 'Get quarterly productivity report',
                handler: (ctx) => this.reportsHandler.handleQuarterlyReport(ctx),
            },
            {
                command: 'yearly_report',
                description: 'Get yearly productivity report',
                handler: (ctx) => this.reportsHandler.handleYearlyReport(ctx),
            },
            {
                command: 'analytics',
                description: 'Get personal analytics',
                handler: (ctx) => this.reportsHandler.handleAnalytics(ctx),
            },
            {
                command: 'trend',
                description: 'Get productivity trend',
                handler: (ctx) => this.reportsHandler.handleProductivityTrend(ctx),
            },
            {
                command: 'help',
                description: 'Get help and usage instructions',
                handler: (ctx) => this.helpHandler.handle(ctx),
            },
            {
                command: 'task_help',
                description: 'Get detailed help for task management',
                handler: (ctx) => this.helpHandler.handleTaskHelp(ctx),
            },
            {
                command: 'report_help',
                description: 'Get detailed help for reports',
                handler: (ctx) => this.helpHandler.handleReportHelp(ctx),
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

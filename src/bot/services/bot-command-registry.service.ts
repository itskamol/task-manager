import { Injectable } from '@nestjs/common';
import { Bot } from 'grammy';
import { BotCommand, TelegramCommand } from '../../common/types/bot.types';
import { StartHandler } from '../handlers/start.handler';
import { ContactHandler } from '../handlers/contact.handler';
import { HelpHandler } from '../handlers/help.handler';
import { TasksHandler } from '../../tasks/handlers/tasks.handler';
import { ReportsHandler } from '../../reports/handlers/reports.handler';
import { BotLoggerService } from './bot-logger.service';
import { BotCommands } from '../config/commands';
import { BotKeyboards } from '../utils/keyboards';
import { SessionService } from './session.service';
import { InteractiveTaskHandler } from '../../tasks/handlers/interactive-task.handler';
import { SessionState } from '../interfaces/session.interface';

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
        private readonly sessionService: SessionService,
        private readonly interactiveTaskHandler: InteractiveTaskHandler,
    ) {
        this.commands = this.setupCommands();
    }

    /**
     * Sets up all bot commands using the new organized structure
     */
    private setupCommands(): BotCommand[] {
        return BotCommands.createCommands({
            startHandler: this.startHandler,
            contactHandler: this.contactHandler,
            helpHandler: this.helpHandler,
            tasksHandler: this.tasksHandler,
            reportsHandler: this.reportsHandler,
        });
    }

    /**
     * Registers visible commands with Telegram using setMyCommands API
     * Only shows the most important commands in the bot menu
     */
    public async registerCommands(bot: Bot): Promise<void> {
        try {
            const visibleCommands = BotCommands.getVisibleCommands(this.commands);
            await bot.api.setMyCommands(visibleCommands);
            this.logger.info(
                `Bot commands registered successfully. Visible commands: ${visibleCommands.length}`,
            );
        } catch (error) {
            this.logger.botError(undefined, error);
            throw error;
        }
    }

    /**
     * Sets up command handlers and interactive elements
     */
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

        // Handle callback queries for reports
        bot.callbackQuery(
            [
                'daily_report',
                'weekly_report',
                'monthly_report',
                'quarterly_report',
                'yearly_report',
                'analytics',
                'trend',
            ],
            async (ctx) => {
                this.logger.callbackReceived(ctx, ctx.callbackQuery.data);
                await ctx.answerCallbackQuery();

                const action = ctx.callbackQuery.data;
                switch (action) {
                    case 'daily_report':
                        await this.reportsHandler.handleDailyReport(ctx);
                        break;
                    case 'weekly_report':
                        await this.reportsHandler.handleWeeklyReport(ctx);
                        break;
                    case 'monthly_report':
                        await this.reportsHandler.handleMonthlyReport(ctx);
                        break;
                    case 'quarterly_report':
                        await this.reportsHandler.handleQuarterlyReport(ctx);
                        break;
                    case 'yearly_report':
                        await this.reportsHandler.handleYearlyReport(ctx);
                        break;
                    case 'analytics':
                        await this.reportsHandler.handleAnalytics(ctx);
                        break;
                    case 'trend':
                        await this.reportsHandler.handleProductivityTrend(ctx);
                        break;
                }
            },
        );

        // Handle help navigation callbacks
        bot.callbackQuery(['task_help', 'report_help', 'main_menu'], async (ctx) => {
            this.logger.callbackReceived(ctx, ctx.callbackQuery.data);
            await ctx.answerCallbackQuery();

            const action = ctx.callbackQuery.data;
            switch (action) {
                case 'task_help':
                    await this.helpHandler.handleTaskHelp(ctx);
                    break;
                case 'report_help':
                    await this.helpHandler.handleReportHelp(ctx);
                    break;
                case 'main_menu':
                    await this.helpHandler.handle(ctx);
                    break;
            }
        });

        // Handle task action callbacks
        bot.callbackQuery(['add_task', 'list_tasks', 'complete_task', 'reports'], async (ctx) => {
            this.logger.callbackReceived(ctx, ctx.callbackQuery.data);
            await ctx.answerCallbackQuery();

            const action = ctx.callbackQuery.data;
            switch (action) {
                case 'add_task':
                    await this.tasksHandler.handleAddTask(ctx);
                    break;
                case 'list_tasks':
                    await this.tasksHandler.handleListTasks(ctx);
                    break;
                case 'complete_task':
                    await this.tasksHandler.handleCompleteTask(ctx);
                    break;
                case 'reports':
                    await ctx.reply('📊 Hisobotlar:', {
                        reply_markup: BotKeyboards.createReportKeyboard(),
                    });
                    break;
            }
        });

        // Handle consent responses for phone number registration
        bot.callbackQuery(['agree_phone', 'decline_phone'], async (ctx) => {
            this.logger.callbackReceived(ctx, ctx.callbackQuery.data);
            await this.contactHandler.handleConsentResponse(ctx);
        });

        // Handle contact messages for phone number registration
        bot.on('message:contact', (ctx) => {
            this.logger.messageReceived(ctx);
            return this.contactHandler.handle(ctx);
        });

        // Handle cancel actions
        bot.callbackQuery('cancel', async (ctx) => {
            await ctx.answerCallbackQuery('Bekor qilindi');
            await ctx.deleteMessage();
        });

        // Handle interactive task creation callbacks
        bot.callbackQuery(['confirm_task', 'edit_task', 'cancel_task'], async (ctx) => {
            this.logger.callbackReceived(ctx, ctx.callbackQuery.data);
            await ctx.answerCallbackQuery();

            const action = ctx.callbackQuery.data;
            const userId = ctx.from?.id?.toString();
            const chatId = ctx.chat?.id;

            if (!userId || !chatId) return;

            switch (action) {
                case 'confirm_task':
                    await this.interactiveTaskHandler.handleTaskConfirmation(ctx);
                    break;
                case 'edit_task':
                    await this.interactiveTaskHandler.handleTaskEdit(ctx);
                    break;
                case 'cancel_task':
                    this.sessionService.clearSession(userId, chatId);
                    await ctx.editMessageText('❌ Vazifa yaratish bekor qilindi.');
                    break;
            }
        });

        // Handle session-aware text messages for ongoing conversations
        bot.on('message:text', async (ctx) => {
            const userId = ctx.from?.id?.toString();
            const chatId = ctx.chat?.id;
            const messageText = ctx.message?.text;

            if (!userId || !chatId || !messageText) return;

            // Check if there's an active session
            const session = this.sessionService.getSession(userId, chatId);

            if (session && session.state !== SessionState.IDLE) {
                // Handle session-based conversation
                this.logger.messageReceived(ctx);

                switch (session.state) {
                    case SessionState.ASKING_DETAILS:
                        await this.interactiveTaskHandler.handleUserResponse(ctx, messageText);
                        break;
                    case SessionState.EDITING_TASK:
                        await this.interactiveTaskHandler.handleTaskEdit(ctx);
                        break;
                    default:
                        // For other states, clear session and handle as normal message
                        this.sessionService.clearSession(userId, chatId);
                        break;
                }
            }
            // If no active session, normal message handling will continue through other handlers
        });
    }

    /**
     * Gets all commands for external use (e.g., help generation)
     */
    public getAllCommands(): BotCommand[] {
        return this.commands;
    }

    /**
     * Gets commands by category
     */
    public getCommandsByCategory(category: string): BotCommand[] {
        return this.commands.filter((cmd) => cmd.category === category);
    }
}

import { BotCommand, CommandGroup, TelegramCommand } from '../../common/types/bot.types';
import { StartHandler } from '../handlers/start.handler';
import { ContactHandler } from '../handlers/contact.handler';
import { HelpHandler } from '../handlers/help.handler';
import { TasksHandler } from '../../tasks/handlers/tasks.handler';
import { ReportsHandler } from '../../reports/handlers/reports.handler';

/**
 * Bot Commands Configuration
 */
export class BotCommands {
    /**
     * Creates all bot commands with handlers and categorization
     */
    static createCommands(handlers: {
        startHandler: StartHandler;
        contactHandler: ContactHandler;
        helpHandler: HelpHandler;
        tasksHandler: TasksHandler;
        reportsHandler: ReportsHandler;
    }): BotCommand[] {
        const { startHandler, contactHandler, helpHandler, tasksHandler, reportsHandler } =
            handlers;

        return [
            // Core Commands (asosiy komandalar)
            {
                command: 'start',
                description: 'Botni ishga tushirish',
                category: 'core',
                handler: (ctx) => startHandler.handle(ctx),
                isVisible: true,
            },
            {
                command: 'register',
                description: "Ro'yxatdan o'tish",
                category: 'core',
                handler: (ctx) => contactHandler.handle(ctx),
                isVisible: true,
            },
            {
                command: 'help',
                description: "Yordam va barcha komandalar ro'yxati",
                category: 'core',
                handler: (ctx) => helpHandler.handle(ctx),
                isVisible: true,
            },

            // Task Management Commands (vazifa boshqaruvi)
            {
                command: 'add',
                description: "Yangi vazifa qo'shish (AI yordami bilan)",
                category: 'task',
                handler: (ctx) => tasksHandler.handleAddTask(ctx),
                isVisible: true,
            },
            {
                command: 'force_add',
                description: "To'g'ridan-to'g'ri vazifa qo'shish",
                category: 'task',
                handler: (ctx) => tasksHandler.handleForceAddTask(ctx),
                isVisible: false,
            },
            {
                command: 'list',
                description: "Barcha vazifalar ro'yxatini ko'rish",
                category: 'task',
                handler: (ctx) => tasksHandler.handleListTasks(ctx),
                isVisible: true,
            },
            {
                command: 'complete',
                description: 'Vazifani bajarilgan deb belgilash',
                category: 'task',
                handler: (ctx) => tasksHandler.handleCompleteTask(ctx),
                isVisible: true,
            },

            // Report Commands (hisobotlar)
            {
                command: 'daily_report',
                description: 'Kunlik samaradorlik hisoboti',
                category: 'report',
                handler: (ctx) => reportsHandler.handleDailyReport(ctx),
                isVisible: true,
            },
            {
                command: 'weekly_report',
                description: 'Haftalik hisobot',
                category: 'report',
                handler: (ctx) => reportsHandler.handleWeeklyReport(ctx),
                isVisible: true,
            },
            {
                command: 'monthly_report',
                description: 'Oylik hisobot',
                category: 'report',
                handler: (ctx) => reportsHandler.handleMonthlyReport(ctx),
                isVisible: true,
            },
            {
                command: 'analytics',
                description: 'Shaxsiy tahlil va statistika',
                category: 'report',
                handler: (ctx) => reportsHandler.handleAnalytics(ctx),
                isVisible: true,
            },

            // Help Commands (yordam)
            {
                command: 'task_help',
                description: "Vazifalar bo'yicha qo'llanma",
                category: 'help',
                handler: (ctx) => helpHandler.handleTaskHelp(ctx),
                isVisible: false,
            },
            {
                command: 'report_help',
                description: "Hisobotlar bo'yicha qo'llanma",
                category: 'help',
                handler: (ctx) => helpHandler.handleReportHelp(ctx),
                isVisible: false,
            },
        ];
    }

    /**
     * Groups commands by category for organized display
     */
    static groupCommands(commands: BotCommand[]): CommandGroup[] {
        const categories: Record<string, CommandGroup> = {
            core: {
                category: 'core',
                title: 'Asosiy komandalar',
                emoji: '🚀',
                commands: [],
            },
            task: {
                category: 'task',
                title: 'Vazifa boshqaruvi',
                emoji: '📝',
                commands: [],
            },
            report: {
                category: 'report',
                title: 'Hisobotlar va tahlil',
                emoji: '📊',
                commands: [],
            },
            help: {
                category: 'help',
                title: 'Yordam',
                emoji: '🆘',
                commands: [],
            },
        };

        commands.forEach((command) => {
            if (command.category && categories[command.category]) {
                categories[command.category].commands.push(command);
            }
        });

        return Object.values(categories);
    }

    /**
     * Gets only visible commands for Telegram setMyCommands API
     */
    static getVisibleCommands(commands: BotCommand[]): TelegramCommand[] {
        // Define the desired order for visible commands
        const commandOrder = [
            'start',
            'register',
            'add',
            'list',
            'complete',
            'daily_report',
            'weekly_report',
            'monthly_report',
            'analytics',
            'help',
        ];

        const visibleCommands = commands.filter((cmd) => cmd.isVisible);

        return visibleCommands
            .sort((a, b) => {
                const indexA = commandOrder.indexOf(a.command);
                const indexB = commandOrder.indexOf(b.command);

                if (indexA !== -1 && indexB !== -1) {
                    return indexA - indexB;
                }
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return 0;
            })
            .map((cmd) => ({
                command: cmd.command,
                description: cmd.description,
            }));
    }

    /**
     * Generates help text for commands
     */
    static generateHelpText(commands: BotCommand[]): string {
        const groups = this.groupCommands(commands);

        let helpText = "<b>🤖 Bot Komandalar Ro'yxati</b>\n\n";

        groups.forEach((group) => {
            const visibleCommands = group.commands.filter((cmd) => cmd.isVisible);
            if (visibleCommands.length > 0) {
                helpText += `<b>${group.emoji} ${group.title}:</b>\n`;
                visibleCommands.forEach((cmd) => {
                    helpText += `/${cmd.command} - ${cmd.description}\n`;
                });
                helpText += '\n';
            }
        });

        helpText += '<i>Batafsil yordam uchun /help komandasidan foydalaning.</i>';

        return helpText;
    }
}

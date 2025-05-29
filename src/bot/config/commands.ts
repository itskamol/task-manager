import { BotCommand, CommandGroup, TelegramCommand } from '../../common/types/bot.types';
import { StartHandler } from '../handlers/start.handler';
import { ContactHandler } from '../handlers/contact.handler';
import { HelpHandler } from '../handlers/help.handler';
import { TasksHandler } from '../../tasks/handlers/tasks.handler';
import { ReportsHandler } from '../../reports/handlers/reports.handler';

/**
 * Bot Commands Configuration
 * Organized by categories with visibility settings for Telegram interface
 */
export class BotCommands {
    /**
     * Creates all bot commands with handlers and categorization
     * @param handlers - Object containing all handler instances
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
            // Core Commands (основные команды)
            {
                command: 'start',
                description: "Botni boshlash va asosiy menuni ko'rish",
                category: 'core',
                handler: (ctx) => startHandler.handle(ctx),
                isVisible: true,
            },
            {
                command: 'register',
                description: "Telefon raqami bilan ro'yxatdan o'tish",
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
                isVisible: false, // Not shown in main menu
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
                isVisible: false,
            },
            {
                command: 'monthly_report',
                description: 'Oylik hisobot',
                category: 'report',
                handler: (ctx) => reportsHandler.handleMonthlyReport(ctx),
                isVisible: false,
            },
            {
                command: 'quarterly_report',
                description: 'Choraklik hisobot',
                category: 'report',
                handler: (ctx) => reportsHandler.handleQuarterlyReport(ctx),
                isVisible: false,
            },
            {
                command: 'yearly_report',
                description: 'Yillik hisobot',
                category: 'report',
                handler: (ctx) => reportsHandler.handleYearlyReport(ctx),
                isVisible: false,
            },
            {
                command: 'analytics',
                description: 'Shaxsiy tahlil va statistika',
                category: 'report',
                handler: (ctx) => reportsHandler.handleAnalytics(ctx),
                isVisible: true,
            },
            {
                command: 'trend',
                description: 'Samaradorlik tendentsiyasi',
                category: 'report',
                handler: (ctx) => reportsHandler.handleProductivityTrend(ctx),
                isVisible: false,
            },

            // Help Commands (yordam)
            {
                command: 'task_help',
                description: 'Vazifa boshqaruvi haqida batafsil',
                category: 'help',
                handler: (ctx) => helpHandler.handleTaskHelp(ctx),
                isVisible: false,
            },
            {
                command: 'report_help',
                description: 'Hisobotlar haqida batafsil',
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
            if (categories[command.category]) {
                categories[command.category].commands.push(command);
            }
        });

        return Object.values(categories).filter((group) => group.commands.length > 0);
    }

    /**
     * Gets only visible commands for Telegram setMyCommands API
     * Ordered by priority for better user experience
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
            'analytics',
            'help',
        ];

        const visibleCommands = commands.filter((cmd) => cmd.isVisible);

        // Sort commands by the defined order
        return visibleCommands
            .sort((a, b) => {
                const indexA = commandOrder.indexOf(a.command);
                const indexB = commandOrder.indexOf(b.command);

                // If both commands are in the order array, sort by position
                if (indexA !== -1 && indexB !== -1) {
                    return indexA - indexB;
                }

                // If only one is in the array, prioritize it
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;

                // If neither is in the array, maintain alphabetical order
                return a.command.localeCompare(b.command);
            })
            .map((cmd) => ({
                command: cmd.command,
                description: cmd.description,
            }));
    }

    /**
     * Generates formatted help text for all commands grouped by category
     */
    static generateHelpText(commands: BotCommand[]): string {
        const groups = this.groupCommands(commands);

        let helpText = '🤖 <b>Task Manager Bot - Barcha komandalar</b>\n\n';

        groups.forEach((group, index) => {
            helpText += `${group.emoji} <b>${group.title}:</b>\n`;

            group.commands.forEach((cmd) => {
                const visibilityMarker = cmd.isVisible ? '' : ' 🔸';
                helpText += `• /${cmd.command} - ${cmd.description}${visibilityMarker}\n`;
            });

            // Add spacing between groups (except for the last one)
            if (index < groups.length - 1) {
                helpText += '\n';
            }
        });

        helpText +=
            "\n💡 <b>Maslahat:</b> Asosiy komandalar Telegram menusida ko'rsatiladi. Boshqalar uchun yuqoridagi ro'yxatdan foydalaning.\n";
        helpText += "🔸 - Telegram menusida ko'rsatilmaydi";

        return helpText;
    }
}

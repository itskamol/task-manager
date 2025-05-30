import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { TasksService } from '../tasks.service';
import { Priority, Status } from '@prisma/client';
import { formatInUserTz } from '../utils/time.utils';
import { BotLoggerService } from '../../bot/services/bot-logger.service';
import { AiService } from '../../ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InteractiveTaskHandler } from './interactive-task.handler';
import { UserService } from '../../common/services/user.service';

@Injectable()
export class TasksHandler {
    constructor(
        private readonly tasksService: TasksService,
        private readonly logger: BotLoggerService,
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly interactiveTaskHandler: InteractiveTaskHandler,
        private readonly userService: UserService,
    ) {}

    async handleAddTask(ctx: Context): Promise<void> {
        if (!ctx.from?.id || !ctx.message?.text) return;

        const taskText = ctx.message.text.split(' ').slice(1).join(' ');
        if (!taskText) {
            await ctx.reply(
                "📝 Vazifa qo'shish:\n\n" +
                    'Foydalanish: /add [vazifa nomi]\n\n' +
                    '📌 Misollar:\n' +
                    "• /add Kitob o'qish\n" +
                    '• /add Urgent: Prezentatsiya tayyorlash\n' +
                    '• /add Important: Doktor bilan uchrashuv\n' +
                    '• /add Xarid qilish: non, sut, tuxum\n\n' +
                    '💡 Maslahat: Vazifa nomini aniqroq yozing, AI yaxshiroq tahlil qiladi!',
            );
            return;
        }

        try {
            // Ensure user exists before proceeding
            await this.ensureUserExists(ctx, ctx.from.id.toString());

            // Use interactive task handler for better user experience
            await this.interactiveTaskHandler.handleTaskCreation(ctx, taskText);

            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply(
                "⚠️ Uzr, vazifa yaratishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
            );
        }
    }

    async handleListTasks(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            // Ensure user exists before proceeding
            await this.ensureUserExists(ctx, ctx.from.id.toString());

            // Get user data
            const user = await this.userService.findByTelegramId(ctx.from.id.toString());
            if (!user) {
                await ctx.reply("❌ Foydalanuvchi ma'lumotlarini olishda xatolik.");
                return;
            }

            const tasks = await this.tasksService.getUserTasks(user.id);

            if (tasks.length === 0) {
                await ctx.reply(
                    "📝 Hozircha vazifalaringiz yo'q.\n\n" +
                        "Yangi vazifa qo'shish uchun:\n" +
                        '/add [vazifa nomi]\n\n' +
                        "Misol: /add Kitob o'qish",
                );
                return;
            }

            // Use AI to optimize task order
            const optimizedTasks = await this.aiService.optimizeSchedule(tasks);

            const userTimezone = user.timezone;

            const taskList = optimizedTasks
                .map((task, index) => {
                    const status = task.status === Status.DONE ? '✅' : '⏳';
                    const priority = this.getPriorityEmoji(task.priority);
                    const deadline = formatInUserTz(task.deadline, userTimezone);
                    const deadlineText = deadline ? `📅 ${deadline}` : '📅 Muddat belgilanmagan';
                    const estimatedTime = task.estimatedTime
                        ? `⏱️ ${task.estimatedTime} daqiqa`
                        : '';

                    return (
                        `${index + 1}. ${status} ${priority} ${task.title}\n` +
                        `   ${deadlineText}${estimatedTime ? `\n   ${estimatedTime}` : ''}`
                    );
                })
                .join('\n\n');

            await ctx.reply(
                '📋 Sizning vazifalaringiz (AI tomonidan tartibga solingan):\n\n' +
                    taskList +
                    "\n\n💡 Yangi vazifa qo'shish: /add [vazifa nomi]\n" +
                    '📊 Hisobot: /report\n' +
                    '❓ Yordam: /help',
            );

            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply(
                "Uzr, vazifalarni ko'rsatishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
            );
        }
    }

    async handleForceAddTask(ctx: Context): Promise<void> {
        if (!ctx.from?.id || !ctx.message?.text) return;

        const taskText = ctx.message.text.split(' ').slice(1).join(' ');
        if (!taskText) {
            await ctx.reply(
                "⚡ Majburiy vazifa qo'shish:\n\n" +
                    'Foydalanish: /force_add [vazifa nomi]\n\n' +
                    "Bu buyruq AI savollarisiz to'g'ridan-to'g'ri vazifa yaratadi.\n" +
                    "Misol: /force_add Kitob o'qish",
            );
            return;
        }

        try {
            // Ensure user exists before proceeding
            const telegramUser = ctx.from;
            if (!telegramUser) return;

            await this.ensureUserExists(ctx, telegramUser.id.toString());

            // Get user data for task creation
            const user = await this.userService.findByTelegramId(telegramUser.id.toString());
            if (!user) {
                await ctx.reply("❌ Foydalanuvchi ma'lumotlarini olishda xatolik.");
                return;
            }

            // Create task directly without AI questions
            const task = await this.tasksService.createTaskWithAISuggestions(
                user.id,
                taskText,
                user.timezone,
            );

            const formattedDeadline = formatInUserTz(task.deadline, user.timezone);
            const deadlineText = formattedDeadline
                ? `📅 Muddat: ${formattedDeadline}`
                : '📅 Muddat belgilanmagan';
            const estimatedTimeText = task.estimatedTime
                ? `⏱️ Taxminiy vaqt: ${task.estimatedTime} daqiqa`
                : '';

            // Send confirmation
            await ctx.reply(
                `⚡ Vazifa majburiy yaratildi!\n\n` +
                    `📝 **${task.title}**\n` +
                    `🎯 Muhimlik: ${this.getPriorityEmoji(task.priority)} ${task.priority}\n` +
                    `${deadlineText}\n` +
                    `${estimatedTimeText}\n\n` +
                    `🤖 AI tavsiyalari avtomatik qo'llanildi.\n\n` +
                    `📋 /list - Barcha vazifalarni ko'rish`,
            );

            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply(
                "⚠️ Uzr, vazifa yaratishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
            );
        }
    }

    async handleCompleteTask(ctx: Context): Promise<void> {
        if (!ctx.from?.id || !ctx.message?.text) return;

        const taskNumber = ctx.message.text.split(' ')[1];
        if (!taskNumber || isNaN(parseInt(taskNumber))) {
            await ctx.reply(
                '✅ Vazifani bajarish:\n\n' +
                    'Foydalanish: /complete [vazifa raqami]\n\n' +
                    "Avval /list buyrug'i bilan vazifalar ro'yxatini ko'ring va " +
                    'vazifa raqamini kiriting.\n\n' +
                    'Misol: /complete 1',
            );
            return;
        }

        try {
            // Ensure user exists before proceeding
            await this.ensureUserExists(ctx, ctx.from.id.toString());

            // Get user data
            const user = await this.userService.findByTelegramId(ctx.from.id.toString());
            if (!user) {
                await ctx.reply("❌ Foydalanuvchi ma'lumotlarini olishda xatolik.");
                return;
            }

            const tasks = await this.tasksService.getUserTasks(user.id);
            const taskIndex = parseInt(taskNumber) - 1;

            if (taskIndex < 0 || taskIndex >= tasks.length) {
                await ctx.reply(
                    `❌ Noto'g'ri vazifa raqami: ${taskNumber}\n\n` +
                        `Mavjud vazifalar: 1-${tasks.length}\n` +
                        "Avval /list buyrug'i bilan ro'yxatni ko'ring.",
                );
                return;
            }

            const task = tasks[taskIndex];

            if (task.status === 'DONE') {
                await ctx.reply(`✅ Bu vazifa allaqachon bajarilgan: "${task.title}"`);
                return;
            }

            const updatedTask = await this.tasksService.updateTask(task.id, user.id, {
                status: 'DONE' as any,
            });

            await ctx.reply(
                `🎉 Tabriklaymiz! Vazifa bajarildi:\n\n` +
                    `✅ ${updatedTask.title}\n\n` +
                    `📊 /list - Qolgan vazifalarni ko'rish\n` +
                    `📈 /daily_report - Bugungi natijalaringiz`,
            );

            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply(
                "⚠️ Uzr, vazifani bajarishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
            );
        }
    }

    private async ensureUserExists(ctx: Context, userId: string): Promise<void> {
        try {
            const telegramUser = ctx.from;
            if (!telegramUser) {
                throw new Error('Telegram user data not available');
            }

            await this.userService.ensureUserExists(telegramUser.id.toString(), {
                firstName: telegramUser.first_name,
                lastName: telegramUser.last_name,
                username: telegramUser.username,
            });
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            throw new Error('User registration failed');
        }
    }

    private getPriorityEmoji(priority: Priority): string {
        switch (priority) {
            case Priority.HIGH:
                return '🔴';
            case Priority.MEDIUM:
                return '🟡';
            case Priority.LOW:
                return '🟢';
            default:
                return '⚪️';
        }
    }
}

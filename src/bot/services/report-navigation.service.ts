import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { BotKeyboards } from '../utils/keyboards';
import { BotLoggerService } from './bot-logger.service';
import { ReportsHandler } from '../../reports/handlers/reports.handler';

/**
 * Service for handling report navigation and interactive keyboards
 * Demonstrates how to use the new keyboard system for reports
 */
@Injectable()
export class ReportNavigationService {
    constructor(
        private readonly logger: BotLoggerService,
        private readonly reportsHandler: ReportsHandler,
    ) {}

    /**
     * Shows the main reports menu with interactive keyboard
     */
    async showReportsMenu(ctx: Context): Promise<void> {
        const menuText = `📊 <b>Hisobotlar va Tahlil</b>

Quyidagi hisobotlardan birini tanlang:

📅 <b>Kunlik hisobot</b> - Bugungi samaradorlik
📊 <b>Haftalik hisobot</b> - 7 kunlik tahlil  
📈 <b>Oylik hisobot</b> - Oylik natijalar
📋 <b>Choraklik hisobot</b> - 3 oylik ko'rsatkichlar
📆 <b>Yillik hisobot</b> - Yillik yutuqlar
🔍 <b>Shaxsiy tahlil</b> - Batafsil statistika
📉 <b>Tendentsiya</b> - Samaradorlik o'zgarishi

💡 <b>Maslahat:</b> Dastlab kunlik hisobotdan boshlang!`;

        await ctx.reply(menuText, {
            parse_mode: 'HTML',
            reply_markup: BotKeyboards.createReportKeyboard(),
        });

        this.logger.messageReceived(ctx);
    }

    /**
     * Handles callback queries from report keyboard
     */
    async handleReportCallback(ctx: Context, action: string): Promise<void> {
        this.logger.callbackReceived(ctx, action);

        try {
            await ctx.answerCallbackQuery();

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

                case 'cancel':
                    await ctx.editMessageText('Hisobot tanlash bekor qilindi.');
                    break;

                default:
                    await ctx.editMessageText(
                        "Noma'lum harakat. Iltimos, qaytadan urinib ko'ring.",
                    );
            }
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply("Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
        }
    }

    /**
     * Shows period selection for reports
     */
    async showPeriodSelection(ctx: Context, reportType: string): Promise<void> {
        const menuText = `📅 <b>Davr tanlang</b>

${this.getReportTypeTitle(reportType)} uchun davr tanlang:`;

        await ctx.reply(menuText, {
            parse_mode: 'HTML',
            reply_markup: BotKeyboards.createPeriodSelectionKeyboard(),
        });
    }

    /**
     * Gets the title for report type
     */
    private getReportTypeTitle(reportType: string): string {
        const titles: Record<string, string> = {
            daily: 'Kunlik hisobot',
            weekly: 'Haftalik hisobot',
            monthly: 'Oylik hisobot',
            quarterly: 'Choraklik hisobot',
            yearly: 'Yillik hisobot',
            analytics: 'Shaxsiy tahlil',
            trend: 'Samaradorlik tendentsiyasi',
        };

        return titles[reportType] || 'Hisobot';
    }

    /**
     * Example of how to use confirmation keyboards
     */
    async requestReportConfirmation(ctx: Context, reportType: string): Promise<void> {
        const confirmationText = `⚠️ <b>Tasdiqlash</b>

${this.getReportTypeTitle(reportType)} yaratish 1-2 daqiqa vaqt olishi mumkin.

Davom etishni xohlaysizmi?`;

        await ctx.reply(confirmationText, {
            parse_mode: 'HTML',
            reply_markup: BotKeyboards.createConfirmationKeyboard(
                `confirm_${reportType}`,
                'cancel_report',
            ),
        });
    }
}

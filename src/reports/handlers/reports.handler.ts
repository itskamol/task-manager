import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { ReportsService } from '../reports.service';
import { BotLoggerService } from '../../bot/services/bot-logger.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsHandler {
    constructor(
        private readonly reportsService: ReportsService,
        private readonly logger: BotLoggerService,
        private readonly prisma: PrismaService,
    ) {}

    async handleDailyReport(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply("Iltimos, avval /start buyrug'i orqali ro'yxatdan o'ting.");
                return;
            }

            const report = await this.reportsService.getDailyReport(user.id);
            const reportText = this.formatReportText(report);

            await ctx.reply(reportText, { parse_mode: 'HTML' });
            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply("Kunlik hisobot yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
        }
    }

    async handleWeeklyReport(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply("Iltimos, avval /start buyrug'i orqali ro'yxatdan o'ting.");
                return;
            }

            const report = await this.reportsService.getWeeklyReport(user.id);
            const reportText = this.formatReportText(report);

            await ctx.reply(reportText, { parse_mode: 'HTML' });
            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply("Haftalik hisobot yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
        }
    }

    async handleMonthlyReport(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply("Iltimos, avval /start buyrug'i orqali ro'yxatdan o'ting.");
                return;
            }

            const report = await this.reportsService.getMonthlyReport(user.id);
            const reportText = this.formatReportText(report);

            await ctx.reply(reportText, { parse_mode: 'HTML' });
            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply("Oylik hisobot yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
        }
    }

    async handleQuarterlyReport(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply("Iltimos, avval /start buyrug'i orqali ro'yxatdan o'ting.");
                return;
            }

            const report = await this.reportsService.getQuarterlyReport(user.id);
            const reportText = this.formatReportText(report);

            await ctx.reply(reportText, { parse_mode: 'HTML' });
            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply(
                "Choraklik hisobot yaratishda xatolik yuz berdi. Qayta urinib ko'ring.",
            );
        }
    }

    async handleYearlyReport(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply("Iltimos, avval /start buyrug'i orqali ro'yxatdan o'ting.");
                return;
            }

            const report = await this.reportsService.getYearlyReport(user.id);
            const reportText = this.formatReportText(report);

            await ctx.reply(reportText, { parse_mode: 'HTML' });
            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply("Yillik hisobot yaratishda xatolik yuz berdi. Qayta urinib ko'ring.");
        }
    }

    async handleAnalytics(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply("Iltimos, avval /start buyrug'i orqali ro'yxatdan o'ting.");
                return;
            }

            const analytics = await this.reportsService.getTaskAnalytics(user.id);
            const analyticsText = this.formatAnalyticsText(analytics);

            await ctx.reply(analyticsText, { parse_mode: 'HTML' });
            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply(
                "Tahlil ma'lumotlarini olishda xatolik yuz berdi. Qayta urinib ko'ring.",
            );
        }
    }

    async handleProductivityTrend(ctx: Context): Promise<void> {
        if (!ctx.from?.id) return;

        try {
            const user = await this.prisma.user.findUnique({
                where: { telegramId: BigInt(ctx.from.id) },
            });

            if (!user) {
                await ctx.reply("Iltimos, avval /start buyrug'i orqali ro'yxatdan o'ting.");
                return;
            }

            const trendData = await this.reportsService.getProductivityTrend(user.id, 7); // Last 7 days
            const trendText = this.formatTrendText(trendData);

            await ctx.reply(trendText, { parse_mode: 'HTML' });
            this.logger.messageReceived(ctx);
        } catch (error) {
            this.logger.botError(ctx, error as Error);
            await ctx.reply(
                "Samaradorlik tendentsiyasini olishda xatolik yuz berdi. Qayta urinib ko'ring.",
            );
        }
    }

    private formatReportText(report: any): string {
        const completionPercentage = report.completionRate;
        const productivityEmoji = this.getProductivityEmoji(report.productivityScore);

        return `
<b>📊 ${report.period}</b>

<b>📈 Asosiy ko'rsatkichlar:</b>
• Jami vazifalar: ${report.totalTasks}
• Bajarilgan: ${report.completedTasks} (${completionPercentage}%)
• Kutilayotgan: ${report.pendingTasks}
• Muddati o'tgan: ${report.overdueeTasks}

<b>⏱️ Vaqt tahlili:</b>
• O'rtacha bajarish vaqti: ${report.averageCompletionTime} daqiqa

<b>🎯 Prioritet taqsimoti:</b>
• Yuqori: ${report.priorityDistribution.high}
• O'rta: ${report.priorityDistribution.medium}
• Past: ${report.priorityDistribution.low}

<b>🏆 Samaradorlik bahosi:</b>
${productivityEmoji} ${report.productivityScore}/100

<b>💡 Tahlil va takliflar:</b>
${report.insights.join('\n')}

<b>🚀 Yaxshilash takliflari:</b>
${report.recommendations.join('\n')}
        `.trim();
    }

    private formatAnalyticsText(analytics: any): string {
        return `
<b>📊 Shaxsiy tahlil</b>

<b>🗓️ Faollik tahlili:</b>
• Eng samarali kun: ${analytics.mostProductiveDay}
• Eng samarali soat: ${analytics.mostProductiveHour}:00
• Kunlik o'rtacha vazifalar: ${analytics.averageTasksPerDay}

<b>🔥 Izchillik:</b>
• Hozirgi ketma-ketlik: ${analytics.currentStreak} kun
• Eng uzun ketma-ketlik: ${analytics.longestStreak} kun

<b>📂 Asosiy kategoriyalar:</b>
${analytics.topCategories.length > 0 ? analytics.topCategories.map((cat) => `• ${cat}`).join('\n') : '• Hozircha kategoriyalar aniqlanmagan'}
        `.trim();
    }

    private formatTrendText(trendData: any[]): string {
        const last7Days = trendData.slice(-7);

        let trendText = "<b>📈 So'nggi 7 kunlik samaradorlik</b>\n\n";

        last7Days.forEach((day) => {
            const date = new Date(day.date).toLocaleDateString('uz-UZ', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
            });
            const progressBar = this.createProgressBar(day.productivityScore);

            trendText += `${date}: ${progressBar} ${day.completed} bajarilgan\n`;
        });

        const avgProductivity = Math.round(
            last7Days.reduce((sum, day) => sum + day.productivityScore, 0) / last7Days.length,
        );

        trendText += `\n<b>O'rtacha samaradorlik:</b> ${avgProductivity}%`;

        return trendText;
    }

    private createProgressBar(percentage: number): string {
        const filled = Math.round(percentage / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`;
    }

    private getProductivityEmoji(score: number): string {
        if (score >= 90) return '🏆';
        if (score >= 80) return '🥇';
        if (score >= 70) return '🥈';
        if (score >= 60) return '🥉';
        if (score >= 50) return '👍';
        return '💪';
    }
}

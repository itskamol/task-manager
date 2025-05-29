import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { Status, Priority, Task } from '@prisma/client';
import {
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfQuarter,
    endOfQuarter,
    startOfYear,
    endOfYear,
    subDays,
    subWeeks,
    subMonths,
    subQuarters,
    subYears,
} from 'date-fns';

export interface ReportData {
    period: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueeTasks: number;
    completionRate: number;
    averageCompletionTime: number;
    priorityDistribution: {
        high: number;
        medium: number;
        low: number;
    };
    productivityScore: number;
    insights: string[];
    recommendations: string[];
}

export interface TaskAnalytics {
    mostProductiveDay: string;
    mostProductiveHour: number;
    averageTasksPerDay: number;
    longestStreak: number;
    currentStreak: number;
    topCategories: string[];
}

@Injectable()
export class ReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
    ) {}

    async getDailyReport(userId: string, date: Date = new Date()): Promise<ReportData> {
        const startDate = startOfDay(date);
        const endDate = endOfDay(date);

        const tasks = await this.getTasksInPeriod(userId, startDate, endDate);
        const analytics = await this.calculateAnalytics(tasks, 'daily');

        const aiInsights = await this.aiService.generateReportInsights({
            period: 'daily',
            tasks,
            analytics,
            date: date.toISOString(),
        });

        return {
            period: `Kunlik hisobot - ${date.toLocaleDateString('uz-UZ')}`,
            ...analytics,
            insights: aiInsights.insights,
            recommendations: aiInsights.recommendations,
        };
    }

    async getWeeklyReport(userId: string, date: Date = new Date()): Promise<ReportData> {
        const startDate = startOfWeek(date, { weekStartsOn: 1 }); // Monday start
        const endDate = endOfWeek(date, { weekStartsOn: 1 });

        const tasks = await this.getTasksInPeriod(userId, startDate, endDate);
        const analytics = await this.calculateAnalytics(tasks, 'weekly');

        const aiInsights = await this.aiService.generateReportInsights({
            period: 'weekly',
            tasks,
            analytics,
            date: date.toISOString(),
        });

        return {
            period: `Haftalik hisobot - ${startDate.toLocaleDateString('uz-UZ')} - ${endDate.toLocaleDateString('uz-UZ')}`,
            ...analytics,
            insights: aiInsights.insights,
            recommendations: aiInsights.recommendations,
        };
    }

    async getMonthlyReport(userId: string, date: Date = new Date()): Promise<ReportData> {
        const startDate = startOfMonth(date);
        const endDate = endOfMonth(date);

        const tasks = await this.getTasksInPeriod(userId, startDate, endDate);
        const analytics = await this.calculateAnalytics(tasks, 'monthly');

        const aiInsights = await this.aiService.generateReportInsights({
            period: 'monthly',
            tasks,
            analytics,
            date: date.toISOString(),
        });

        return {
            period: `Oylik hisobot - ${date.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}`,
            ...analytics,
            insights: aiInsights.insights,
            recommendations: aiInsights.recommendations,
        };
    }

    async getQuarterlyReport(userId: string, date: Date = new Date()): Promise<ReportData> {
        const startDate = startOfQuarter(date);
        const endDate = endOfQuarter(date);

        const tasks = await this.getTasksInPeriod(userId, startDate, endDate);
        const analytics = await this.calculateAnalytics(tasks, 'quarterly');

        const aiInsights = await this.aiService.generateReportInsights({
            period: 'quarterly',
            tasks,
            analytics,
            date: date.toISOString(),
        });

        const quarter = Math.floor(date.getMonth() / 3) + 1;

        return {
            period: `Choraklik hisobot - ${quarter}-chorak ${date.getFullYear()}`,
            ...analytics,
            insights: aiInsights.insights,
            recommendations: aiInsights.recommendations,
        };
    }

    async getYearlyReport(userId: string, date: Date = new Date()): Promise<ReportData> {
        const startDate = startOfYear(date);
        const endDate = endOfYear(date);

        const tasks = await this.getTasksInPeriod(userId, startDate, endDate);
        const analytics = await this.calculateAnalytics(tasks, 'yearly');

        const aiInsights = await this.aiService.generateReportInsights({
            period: 'yearly',
            tasks,
            analytics,
            date: date.toISOString(),
        });

        return {
            period: `Yillik hisobot - ${date.getFullYear()}`,
            ...analytics,
            insights: aiInsights.insights,
            recommendations: aiInsights.recommendations,
        };
    }

    async getTaskAnalytics(userId: string): Promise<TaskAnalytics> {
        const allTasks = await this.prisma.task.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });

        const completedTasks = allTasks.filter((task) => task.status === Status.DONE);

        // Calculate most productive day
        const dayStats = this.calculateDayStats(completedTasks);
        const mostProductiveDay = Object.keys(dayStats).reduce((a, b) =>
            dayStats[a] > dayStats[b] ? a : b,
        );

        // Calculate streaks
        const { currentStreak, longestStreak } = this.calculateStreaks(completedTasks);

        // Calculate average tasks per day
        const firstTaskDate = allTasks[0]?.createdAt || new Date();
        const daysSinceStart = Math.max(
            1,
            Math.ceil((Date.now() - firstTaskDate.getTime()) / (1000 * 60 * 60 * 24)),
        );
        const averageTasksPerDay = completedTasks.length / daysSinceStart;

        return {
            mostProductiveDay,
            mostProductiveHour: this.calculateMostProductiveHour(completedTasks),
            averageTasksPerDay: Math.round(averageTasksPerDay * 100) / 100,
            longestStreak,
            currentStreak,
            topCategories: this.extractTopCategories(allTasks),
        };
    }

    async getProductivityTrend(userId: string, days: number = 30): Promise<any[]> {
        const endDate = new Date();
        const startDate = subDays(endDate, days);

        const tasks = await this.getTasksInPeriod(userId, startDate, endDate);

        const dailyStats: any = [];
        for (let i = 0; i < days; i++) {
            const currentDate = subDays(endDate, i);
            const dayStart = startOfDay(currentDate);
            const dayEnd = endOfDay(currentDate);

            const dayTasks = tasks.filter(
                (task) => task.updatedAt >= dayStart && task.updatedAt <= dayEnd,
            );

            const completed = dayTasks.filter((task) => task.status === Status.DONE).length;

            dailyStats.unshift({
                date: currentDate.toISOString().split('T')[0],
                completed,
                created: dayTasks.length,
                productivityScore: this.calculateDayProductivityScore(dayTasks),
            });
        }

        return dailyStats;
    }

    private async getTasksInPeriod(
        userId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<Task[]> {
        return this.prisma.task.findMany({
            where: {
                userId,
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    private async calculateAnalytics(tasks: Task[], period: string) {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((task) => task.status === Status.DONE).length;
        const pendingTasks = tasks.filter((task) => task.status === Status.PENDING).length;

        const now = new Date();
        const overdueeTasks = tasks.filter(
            (task) => task.status === Status.PENDING && task.deadline && task.deadline < now,
        ).length;

        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Calculate average completion time
        const completedWithEstimates = tasks.filter(
            (task) => task.status === Status.DONE && task.estimatedTime,
        );
        const averageCompletionTime =
            completedWithEstimates.length > 0
                ? completedWithEstimates.reduce((sum, task) => sum + (task.estimatedTime || 0), 0) /
                  completedWithEstimates.length
                : 0;

        // Priority distribution
        const priorityDistribution = {
            high: tasks.filter((task) => task.priority === Priority.HIGH).length,
            medium: tasks.filter((task) => task.priority === Priority.MEDIUM).length,
            low: tasks.filter((task) => task.priority === Priority.LOW).length,
        };

        // Productivity score (0-100)
        const productivityScore = this.calculateProductivityScore(tasks);

        return {
            totalTasks,
            completedTasks,
            pendingTasks,
            overdueeTasks,
            completionRate: Math.round(completionRate * 100) / 100,
            averageCompletionTime: Math.round(averageCompletionTime),
            priorityDistribution,
            productivityScore,
        };
    }

    private calculateProductivityScore(tasks: Task[]): number {
        if (tasks.length === 0) return 0;

        const completedTasks = tasks.filter((task) => task.status === Status.DONE);
        const completionRate = completedTasks.length / tasks.length;

        const onTimeCompletions = completedTasks.filter((task) => {
            if (!task.deadline) return true;
            return task.updatedAt <= task.deadline;
        }).length;

        const onTimeRate =
            completedTasks.length > 0 ? onTimeCompletions / completedTasks.length : 0;

        const highPriorityCompleted = completedTasks.filter(
            (task) => task.priority === Priority.HIGH,
        ).length;
        const highPriorityTotal = tasks.filter((task) => task.priority === Priority.HIGH).length;
        const highPriorityRate =
            highPriorityTotal > 0 ? highPriorityCompleted / highPriorityTotal : 1;

        // Weighted score: 40% completion rate, 30% on-time rate, 30% high priority rate
        const score = (completionRate * 0.4 + onTimeRate * 0.3 + highPriorityRate * 0.3) * 100;

        return Math.round(score);
    }

    private calculateDayStats(tasks: Task[]): Record<string, number> {
        const dayNames = [
            'Yakshanba',
            'Dushanba',
            'Seshanba',
            'Chorshanba',
            'Payshanba',
            'Juma',
            'Shanba',
        ];
        const dayStats: Record<string, number> = {};

        dayNames.forEach((day) => (dayStats[day] = 0));

        tasks.forEach((task) => {
            if (task.status === Status.DONE) {
                const dayIndex = task.updatedAt.getDay();
                dayStats[dayNames[dayIndex]]++;
            }
        });

        return dayStats;
    }

    private calculateMostProductiveHour(tasks: Task[]): number {
        const hourStats: Record<number, number> = {};

        for (let i = 0; i < 24; i++) {
            hourStats[i] = 0;
        }

        tasks.forEach((task) => {
            if (task.status === Status.DONE) {
                const hour = task.updatedAt.getHours();
                hourStats[hour]++;
            }
        });

        return parseInt(
            Object.keys(hourStats).reduce((a, b) =>
                hourStats[parseInt(a)] > hourStats[parseInt(b)] ? a : b,
            ),
        );
    }

    private calculateStreaks(tasks: Task[]): { currentStreak: number; longestStreak: number } {
        const completedDates = tasks
            .filter((task) => task.status === Status.DONE)
            .map((task) => startOfDay(task.updatedAt).getTime())
            .filter((date, index, array) => array.indexOf(date) === index)
            .sort((a, b) => a - b);

        if (completedDates.length === 0) {
            return { currentStreak: 0, longestStreak: 0 };
        }

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 1;

        // Calculate longest streak
        for (let i = 1; i < completedDates.length; i++) {
            const daysDiff = (completedDates[i] - completedDates[i - 1]) / (1000 * 60 * 60 * 24);

            if (daysDiff === 1) {
                tempStreak++;
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
            }
        }
        longestStreak = Math.max(longestStreak, tempStreak);

        // Calculate current streak
        const today = startOfDay(new Date()).getTime();
        const lastCompletedDate = completedDates[completedDates.length - 1];
        const daysSinceLastCompleted = (today - lastCompletedDate) / (1000 * 60 * 60 * 24);

        if (daysSinceLastCompleted <= 1) {
            // Count backwards from the most recent date
            currentStreak = 1;
            for (let i = completedDates.length - 2; i >= 0; i--) {
                const daysDiff =
                    (completedDates[i + 1] - completedDates[i]) / (1000 * 60 * 60 * 24);
                if (daysDiff === 1) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }

        return { currentStreak, longestStreak };
    }

    private extractTopCategories(tasks: Task[]): string[] {
        // Simple category extraction based on common keywords
        const categories: Record<string, number> = {};

        tasks.forEach((task) => {
            const text = (task.title + ' ' + (task.description || '')).toLowerCase();

            if (text.includes('work') || text.includes('ish') || text.includes('meeting')) {
                categories['Ish'] = (categories['Ish'] || 0) + 1;
            }
            if (text.includes('health') || text.includes('sport') || text.includes('exercise')) {
                categories['Salomatlik'] = (categories['Salomatlik'] || 0) + 1;
            }
            if (text.includes('study') || text.includes('learn') || text.includes('kitob')) {
                categories["Ta'lim"] = (categories["Ta'lim"] || 0) + 1;
            }
            if (text.includes('shopping') || text.includes('buy') || text.includes('sotib')) {
                categories['Xaridlar'] = (categories['Xaridlar'] || 0) + 1;
            }
            if (text.includes('family') || text.includes('oila') || text.includes('friend')) {
                categories['Oila'] = (categories['Oila'] || 0) + 1;
            }
        });

        return Object.entries(categories)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([category]) => category);
    }

    private calculateDayProductivityScore(tasks: Task[]): number {
        if (tasks.length === 0) return 0;

        const completed = tasks.filter((task) => task.status === Status.DONE).length;
        const completionRate = completed / tasks.length;

        return Math.round(completionRate * 100);
    }
}

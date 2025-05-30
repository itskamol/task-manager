import { Injectable } from '@nestjs/common';
import {
    format,
    parseISO,
    addDays,
    addWeeks,
    addMonths,
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    subDays,
    subWeeks,
    subMonths,
    subYears,
    isBefore,
    isAfter,
    isEqual,
    differenceInDays,
    differenceInHours,
    differenceInMinutes,
} from 'date-fns';
import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

@Injectable()
export class DateService {
    private readonly defaultTimezone = 'Asia/Tashkent';

    /**
     * Format date for task deadline display
     */
    formatTaskDeadline(date: Date, timezone?: string): string {
        const tz = timezone || this.defaultTimezone;
        try {
            const zonedDate = toZonedTime(date, tz);
            return formatTz(zonedDate, 'dd.MM.yyyy HH:mm', { timeZone: tz });
        } catch (error) {
            return format(date, 'dd.MM.yyyy HH:mm');
        }
    }

    /**
     * Format date for reports (longer format)
     */
    formatReportDate(date: Date, timezone?: string): string {
        const tz = timezone || this.defaultTimezone;
        try {
            const zonedDate = toZonedTime(date, tz);
            return formatTz(zonedDate, 'EEEE, dd MMMM yyyy HH:mm', { timeZone: tz });
        } catch (error) {
            return format(date, 'EEEE, dd MMMM yyyy HH:mm');
        }
    }

    /**
     * Get current time in specific timezone
     */
    now(timezone?: string): Date {
        const tz = timezone || this.defaultTimezone;
        try {
            return toZonedTime(new Date(), tz);
        } catch (error) {
            return new Date();
        }
    }

    /**
     * Get date range for reports
     */
    getReportDateRange(period: ReportPeriod, timezone?: string): { start: Date; end: Date } {
        const tz = timezone || this.defaultTimezone;
        const now = this.now(tz);

        switch (period) {
            case 'daily':
                return {
                    start: startOfDay(now),
                    end: endOfDay(now),
                };

            case 'weekly':
                return {
                    start: startOfWeek(now, { weekStartsOn: 1 }), // Monday start
                    end: endOfWeek(now, { weekStartsOn: 1 }),
                };

            case 'monthly':
                return {
                    start: startOfMonth(now),
                    end: endOfMonth(now),
                };

            case 'quarterly':
                const quarterStart = startOfMonth(subMonths(now, now.getMonth() % 3));
                const quarterEnd = endOfMonth(addMonths(quarterStart, 2));
                return {
                    start: quarterStart,
                    end: quarterEnd,
                };

            case 'yearly':
                return {
                    start: startOfYear(now),
                    end: endOfYear(now),
                };

            default:
                throw new Error(`Unsupported period: ${period}`);
        }
    }

    /**
     * Parse user input date string
     */
    parseUserDate(dateString: string, timezone?: string): Date {
        const tz = timezone || this.defaultTimezone;
        try {
            // Handle different date formats
            let parsedDate: Date;

            if (dateString.includes('T') || dateString.includes(' ')) {
                parsedDate = parseISO(dateString);
            } else {
                // If only date provided, assume noon time
                parsedDate = parseISO(`${dateString}T12:00:00`);
            }

            return fromZonedTime(parsedDate, tz);
        } catch (error) {
            throw new Error(`Invalid date format: ${dateString}`);
        }
    }

    /**
     * Add time to date in specific timezone
     */
    addTime(date: Date, amount: number, unit: TimeUnit, timezone?: string): Date {
        const tz = timezone || this.defaultTimezone;

        try {
            const zonedDate = toZonedTime(date, tz);
            let result: Date;

            switch (unit) {
                case 'minutes':
                    result = addDays(zonedDate, amount / (24 * 60)); // Convert to fraction of day
                    break;
                case 'hours':
                    result = addDays(zonedDate, amount / 24); // Convert to fraction of day
                    break;
                case 'days':
                    result = addDays(zonedDate, amount);
                    break;
                case 'weeks':
                    result = addWeeks(zonedDate, amount);
                    break;
                case 'months':
                    result = addMonths(zonedDate, amount);
                    break;
                case 'years':
                    result = addMonths(zonedDate, amount * 12);
                    break;
                default:
                    throw new Error(`Unsupported time unit: ${unit}`);
            }

            return fromZonedTime(result, tz);
        } catch (error) {
            throw new Error(`Failed to add time: ${error.message}`);
        }
    }

    /**
     * Get time until deadline
     */
    getTimeUntilDeadline(
        deadline: Date,
        timezone?: string,
    ): {
        days: number;
        hours: number;
        minutes: number;
        isOverdue: boolean;
    } {
        const now = this.now(timezone);
        const isOverdue = isBefore(deadline, now);

        const targetDate = isOverdue ? now : deadline;
        const referenceDate = isOverdue ? deadline : now;

        const days = differenceInDays(targetDate, referenceDate);
        const hours = differenceInHours(targetDate, referenceDate) % 24;
        const minutes = differenceInMinutes(targetDate, referenceDate) % 60;

        return {
            days,
            hours,
            minutes,
            isOverdue,
        };
    }

    /**
     * Check if timezone is valid
     */
    isValidTimezone(timezone: string): boolean {
        try {
            toZonedTime(new Date(), timezone);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get relative time description (e.g., "2 hours ago", "in 3 days")
     */
    getRelativeTime(date: Date, timezone?: string): string {
        const now = this.now(timezone);
        const isPast = isBefore(date, now);
        const targetDate = isPast ? now : date;
        const referenceDate = isPast ? date : now;

        const days = differenceInDays(targetDate, referenceDate);
        const hours = differenceInHours(targetDate, referenceDate);
        const minutes = differenceInMinutes(targetDate, referenceDate);

        const prefix = isPast ? '' : 'in ';
        const suffix = isPast ? ' ago' : '';

        if (days > 0) {
            return `${prefix}${days} day${days > 1 ? 's' : ''}${suffix}`;
        } else if (hours > 0) {
            return `${prefix}${hours} hour${hours > 1 ? 's' : ''}${suffix}`;
        } else if (minutes > 0) {
            return `${prefix}${minutes} minute${minutes > 1 ? 's' : ''}${suffix}`;
        } else {
            return 'just now';
        }
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(minutes: number): string {
        if (minutes < 60) {
            return `${minutes} min`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours < 24) {
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }

        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
}

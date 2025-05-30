import { format, parseISO, differenceInMilliseconds, addHours, addDays, addWeeks } from 'date-fns';
import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';

/**
 * Convert a date string in user timezone to UTC Date object
 */
export function convertToUTC(dateString: string, userTz: string): Date {
    try {
        // If dateString is just a date without time, append a default time
        const fullDateString =
            dateString.includes('T') || dateString.includes(' ')
                ? dateString
                : `${dateString} 00:00:00`;

        return fromZonedTime(fullDateString, userTz);
    } catch (error) {
        throw new Error(`Invalid date string or timezone: ${dateString}, ${userTz}`);
    }
}

/**
 * Convert UTC date to user timezone string
 */
export function formatInUserTz(date: Date | null, userTz: string): string | null {
    if (!date) return null;
    try {
        const zonedDate = toZonedTime(date, userTz);
        return formatTz(zonedDate, 'yyyy-MM-dd HH:mm:ss', { timeZone: userTz });
    } catch (error) {
        return format(date, 'yyyy-MM-dd HH:mm:ss');
    }
}

/**
 * Calculate delay in milliseconds from now until the target UTC date
 */
export function getDelayUntil(targetDate: Date): number {
    const now = new Date();
    return differenceInMilliseconds(targetDate, now);
}

/**
 * Validate if the timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
    try {
        // Try to create a date in the timezone
        const testDate = new Date();
        toZonedTime(testDate, timezone);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get current time in specific timezone
 */
export function getCurrentTimeInTz(timezone: string): string {
    try {
        const now = new Date();
        const zonedDate = toZonedTime(now, timezone);
        return formatTz(zonedDate, 'yyyy-MM-dd HH:mm:ss', { timeZone: timezone });
    } catch (error) {
        return format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    }
}

/**
 * Add time to a date in a specific timezone
 */
export function addTimeInTimezone(
    date: Date,
    amount: number,
    unit: 'hours' | 'days' | 'weeks',
    timezone: string,
): Date {
    const zonedDate = toZonedTime(date, timezone);
    let newDate: Date;

    switch (unit) {
        case 'hours':
            newDate = addHours(zonedDate, amount);
            break;
        case 'days':
            newDate = addDays(zonedDate, amount);
            break;
        case 'weeks':
            newDate = addWeeks(zonedDate, amount);
            break;
        default:
            throw new Error(`Unsupported time unit: ${unit}`);
    }

    return fromZonedTime(newDate, timezone);
}

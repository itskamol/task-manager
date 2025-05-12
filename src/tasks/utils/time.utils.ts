import * as moment from 'moment-timezone';

/**
 * Convert a date string in user timezone to UTC Date object
 */
export function convertToUTC(dateString: string, userTz: string): Date {
    return moment.tz(dateString, userTz).utc().toDate();
}

/**
 * Convert UTC date to user timezone string
 */
export function formatInUserTz(date: Date | null, userTz: string): string | null {
    if (!date) return null;
    return moment(date).tz(userTz).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * Calculate delay in milliseconds from now until the target UTC date
 */
export function getDelayUntil(targetDate: Date): number {
    const now = moment.utc();
    const target = moment.utc(targetDate);
    return target.diff(now);
}

/**
 * Validate if the timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
    return moment.tz.zone(timezone) !== null;
}

/**
 * Get current time in specific timezone
 */
export function getCurrentTimeInTz(timezone: string): string {
    return moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss');
}

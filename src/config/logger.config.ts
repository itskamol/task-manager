import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { format } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

const TIMEZONE = 'Asia/Tashkent';
const APP_NAME = 'TaskManager';

const timezoneFormat = winston.format((info) => {
    const now = new Date();
    const zonedDate = toZonedTime(now, TIMEZONE);
    info.timestamp = formatTz(zonedDate, 'yyyy-MM-dd HH:mm:ss', { timeZone: TIMEZONE });
    return info;
});

const errorFormat = winston.format((info) => {
    if (info.error instanceof Error) {
        const error = info.error;
        info.stack = error.stack;
        if (error.name === 'ZodError' && 'issues' in error) {
            info.validation = (error as any).issues;
            delete info.error;
        }
    }
    return info;
});

const customFormat = winston.format.printf(({ level, message, timestamp, context, stack }) => {
    const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `[${APP_NAME}] ${timestamp} ${level.toUpperCase()} ${message}${contextStr}${stackStr}`;
});

export const loggerConfig: WinstonModuleOptions = {
    transports: [
        new winston.transports.Console({
            level: 'debug',
            format: winston.format.combine(
                timezoneFormat(),
                winston.format.colorize(),
                errorFormat(),
                customFormat,
            ),
        }),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(timezoneFormat(), errorFormat(), winston.format.json()),
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(timezoneFormat(), errorFormat(), winston.format.json()),
        }),
    ],
};

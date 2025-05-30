import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { format } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

const TIMEZONE = 'Asia/Tashkent';
const APP_NAME = 'TaskManager';
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

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

const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
        level: NODE_ENV === 'production' ? 'warn' : 'debug',
        format: winston.format.combine(
            timezoneFormat(),
            winston.format.colorize(),
            errorFormat(),
            customFormat,
        ),
    }),
];

// File transports for production
if (NODE_ENV === 'production') {
    transports.push(
        // Error logs
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(timezoneFormat(), errorFormat(), winston.format.json()),
        }),

        // Combined logs (info and above)
        new winston.transports.File({
            filename: 'logs/combined.log',
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(timezoneFormat(), errorFormat(), winston.format.json()),
        }),

        // Application logs (warn and above)
        new winston.transports.File({
            filename: 'logs/app.log',
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 7,
            format: winston.format.combine(timezoneFormat(), errorFormat(), winston.format.json()),
        }),
    );
} else {
    // Development file transports
    transports.push(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(timezoneFormat(), errorFormat(), winston.format.json()),
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(timezoneFormat(), errorFormat(), winston.format.json()),
        }),
    );
}

export const loggerConfig: WinstonModuleOptions = {
    level: LOG_LEVEL,
    transports,
};

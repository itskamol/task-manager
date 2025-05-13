import { Injectable, LoggerService, LogLevel, Scope } from '@nestjs/common';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import { getLogLevels } from './logger.utils';
import { LogContext } from './logger.interface';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLoggerService implements LoggerService {
    private logger: winston.Logger;
    private context?: string;

    constructor(context?: string) {
        this.context = context;
        this.logger = this.createLogger();
    }

    setContext(context: string) {
        this.context = context;
    }

    log(message: string, context?: LogContext) {
        this.logger.info(message, this.formatContext(context));
    }

    error(message: string, stack?: string, context?: LogContext) {
        this.logger.error(message, this.formatContext({ ...context, stack }));
    }

    warn(message: string, context?: LogContext) {
        this.logger.warn(message, this.formatContext(context));
    }

    debug(message: string, context?: LogContext) {
        this.logger.debug(message, this.formatContext(context));
    }

    verbose(message: string, context?: LogContext) {
        this.logger.verbose(message, this.formatContext(context));
    }

    private createLogger(): winston.Logger {
        const logLevels = getLogLevels(process.env.NODE_ENV === 'production');
        
        const errorStackFormat = winston.format((info) => {
            if (info.error instanceof Error) {
                info.stack = info.error.stack;
                if ('issues' in info.error) {
                    info.validation = (info.error as any).issues;
                }
                // Remove circular reference
                delete info.error;
            }
            return info;
        });

        return winston.createLogger({
            levels: winston.config.npm.levels,
            level: process.env.LOG_LEVEL || 'info',
            transports: [
                // Console transport with colored output for development
                new winston.transports.Console({
                    level: logLevels[0],
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.ms(),
                        errorStackFormat(),
                        nestWinstonModuleUtilities.format.nestLike('TaskManager', {
                            prettyPrint: true,
                            colors: true,
                        })
                    ),
                }),
                // File transport for errors
                new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        errorStackFormat(),
                        winston.format.json()
                    ),
                }),
                // File transport for all logs
                new winston.transports.File({
                    filename: 'logs/combined.log',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        errorStackFormat(),
                        winston.format.json()
                    ),
                }),
            ],
        });
    }

    private formatContext(context?: LogContext): any {
        return {
            context: this.context,
            ...context,
            timestamp: new Date().toISOString(),
        };
    }
}

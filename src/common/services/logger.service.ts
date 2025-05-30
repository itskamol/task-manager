import { Injectable, Inject, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

interface BusinessEventData {
    event: string;
    data: any;
    userId?: string;
    context?: string;
}

interface PerformanceMetric {
    operation: string;
    duration: number;
    context?: string;
    metadata?: any;
}

@Injectable()
export class LoggerService implements NestLoggerService {
    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

    log(message: string, context?: string | Record<string, any>): void {
        const contextObj = typeof context === 'string' ? { service: context } : context;
        this.info(message, contextObj);
    }

    info(message: string, context?: Record<string, any>): void {
        this.logger.info(message, { context });
    }

    error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
        this.logger.error(message, { error, context });
    }

    warn(message: string, context?: Record<string, any>): void {
        this.logger.warn(message, { context });
    }

    debug(message: string, context?: Record<string, any>): void {
        this.logger.debug(message, { context });
    }

    verbose(message: string, context?: Record<string, any>): void {
        this.logger.verbose(message, { context });
    }

    setLogLevels?(levels: string[]): void {
        // Winston logger doesn't support dynamic log level changes per module
        // This is left empty as per NestJS LoggerService interface requirement
    }

    // Enhanced production logging methods

    // Business event logging
    logBusinessEvent(eventData: BusinessEventData): void {
        this.logger.info('Business Event', {
            ...eventData,
            timestamp: new Date().toISOString(),
            type: 'business_event',
            level: 'info',
        });
    }

    // Performance monitoring
    logPerformance(metric: PerformanceMetric): void {
        this.logger.info('Performance Metric', {
            ...metric,
            timestamp: new Date().toISOString(),
            type: 'performance',
            level: 'info',
        });
    }

    // User action logging
    logUserAction(action: string, userId: string, data?: any): void {
        this.logBusinessEvent({
            event: action,
            data: data || {},
            userId,
            context: 'UserAction',
        });
    }

    // AI operation logging
    logAiOperation(operation: string, duration: number, success: boolean, metadata?: any): void {
        this.logPerformance({
            operation: `AI_${operation.toUpperCase()}`,
            duration,
            context: 'AiService',
            metadata: {
                success,
                ...metadata,
            },
        });
    }

    // Bot interaction logging
    logBotInteraction(type: 'command' | 'callback' | 'message', data: any): void {
        this.logBusinessEvent({
            event: `BOT_${type.toUpperCase()}`,
            data,
            userId: data.userId?.toString(),
            context: 'TelegramBot',
        });
    }

    // Database operation logging
    logDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
        this.logPerformance({
            operation: `DB_${operation.toUpperCase()}`,
            duration,
            context: 'Database',
            metadata: {
                table,
                success,
            },
        });
    }

    // Security event logging
    logSecurityEvent(event: string, details: any, severity: 'low' | 'medium' | 'high' = 'medium'): void {
        const logMethod = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';

        this.logger[logMethod]('Security Event', {
            event,
            details,
            severity,
            timestamp: new Date().toISOString(),
            type: 'security',
            context: 'Security',
        });
    }
}

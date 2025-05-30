import { Injectable, Inject, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class LoggerService implements NestLoggerService {
    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

    private formatMessage(message: string): string {
        return `[${new Date().toISOString()}] ${message}`;
    }

    log(message: string, context?: string | Record<string, any>): void {
        const contextObj = typeof context === 'string' ? { service: context } : context;
        this.info(message, contextObj);
    }

    info(message: string, context?: Record<string, any>): void {
        this.logger.info(this.formatMessage(message), { context });
    }

    error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
        this.logger.error(this.formatMessage(message), { error, context });
    }

    warn(message: string, context?: Record<string, any>): void {
        this.logger.warn(this.formatMessage(message), { context });
    }

    debug(message: string, context?: Record<string, any>): void {
        this.logger.debug(this.formatMessage(message), { context });
    }

    verbose(message: string, context?: Record<string, any>): void {
        this.logger.verbose(this.formatMessage(message), { context });
    }

    setLogLevels?(levels: string[]): void {
        // Winston logger doesn't support dynamic log level changes per module
        // This is left empty as per NestJS LoggerService interface requirement
    }
}

import { LogLevel } from '@nestjs/common';

export function getLogLevels(isProduction: boolean): LogLevel[] {
    if (isProduction) {
        return ['log', 'warn', 'error'];
    }
    return ['log', 'error', 'warn', 'debug', 'verbose'];
}

export const loggerConstants = {
    DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss',
    MAX_SIZE: '20m',
    MAX_FILES: '14d',
} as const;

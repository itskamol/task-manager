export interface LogContext {
    [key: string]: any;
    userId?: string;
    requestId?: string;
    telegramUserId?: number;
    error?: Error;
}

export interface LoggerConfig {
    isProduction?: boolean;
    logLevel?: string;
    defaultContext?: string;
}

import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { LoggerService } from 'src/common/services/logger.service';

@Injectable()
export class BotLoggerService {
    botInfo(message: string) {
        this.logger.info(message);
    }
    constructor(private readonly logger: LoggerService) {}

    private formatContext(ctx: Context): Record<string, any> {
        const from = ctx.from;
        return {
            service: 'TelegramBot',
            chatId: ctx.chat?.id,
            userId: from?.id,
            username: from?.username,
            messageId: ctx.message?.message_id,
            updateType: ctx.update ? Object.keys(ctx.update)[0] : undefined,
            command: ctx.message?.text?.startsWith('/')
                ? ctx.message.text.split(' ')[0]
                : undefined,
        };
    }

    // Command and event logging
    commandReceived(ctx: Context, command: string): void {
        this.logger.info(`Command received: ${command}`, this.formatContext(ctx));
    }

    messageReceived(ctx: Context): void {
        this.logger.info('Message received', this.formatContext(ctx));
    }

    callbackReceived(ctx: Context, data: string): void {
        this.logger.info(`Callback received: ${data}`, this.formatContext(ctx));
    }

    // User-related logging
    userRegistered(ctx: Context, userId: string): void {
        this.logger.info('User registered successfully', {
            ...this.formatContext(ctx),
            registeredUserId: userId,
        });
    }

    userRegistrationFailed(ctx: Context, error: Error): void {
        this.logger.error('User registration failed', error, this.formatContext(ctx));
    }

    // Bot lifecycle logging
    botStarted(): void {
        this.logger.info('Telegram bot started successfully', { service: 'TelegramBot' });
    }

    botStopped(): void {
        this.logger.info('Telegram bot stopped successfully', { service: 'TelegramBot' });
    }

    // Error handling
    botError(ctx: Context | undefined, error: Error): void {
        this.logger.error(
            'Bot error occurred',
            error,
            ctx ? this.formatContext(ctx) : { service: 'TelegramBot' },
        );
    }

    // Debug logging
    debug(message: string, ctx?: Context): void {
        this.logger.debug(message, ctx ? this.formatContext(ctx) : { service: 'TelegramBot' });
    }

    // General info logging
    info(message: string, ctx?: Context): void {
        this.logger.info(message, ctx ? this.formatContext(ctx) : { service: 'TelegramBot' });
    }

    // Warning logging
    warn(message: string, ctx?: Context): void {
        this.logger.warn(message, ctx ? this.formatContext(ctx) : { service: 'TelegramBot' });
    }
}

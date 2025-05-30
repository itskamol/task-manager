import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { LoggerService } from '../../common/services/logger.service';

@Injectable()
export class BotLoggerService {
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

    botError(ctx: Context | undefined, error: Error): void {
        this.logger.error(
            'Bot error occurred',
            error,
            ctx ? this.formatContext(ctx) : { service: 'TelegramBot' },
        );
    }

    debug(message: string, ctx?: Context): void {
        this.logger.debug(message, ctx ? this.formatContext(ctx) : { service: 'TelegramBot' });
    }

    info(message: string, ctx?: Context): void {
        this.logger.info(message, ctx ? this.formatContext(ctx) : { service: 'TelegramBot' });
    }

    warn(message: string, ctx?: Context): void {
        this.logger.warn(message, ctx ? this.formatContext(ctx) : { service: 'TelegramBot' });
    }

    messageReceived(ctx: Context): void {
        this.debug('Message received and processed', ctx);
    }

    commandReceived(ctx: Context, command: string): void {
        this.debug(`Command received: ${command}`, ctx);
    }

    callbackReceived(ctx: Context, data: string): void {
        this.debug(`Callback received: ${data}`, ctx);
    }

    userRegistered(ctx: Context, userId: string): void {
        this.info(`User registered: ${userId}`, ctx);
    }

    userRegistrationFailed(ctx: Context, error: Error): void {
        this.botError(ctx, error);
    }
}

import { Injectable } from '@nestjs/common';
import { Context, Keyboard } from 'grammy';
import { BotLoggerService } from '../bot-logger.service';
import { AuthService } from '../auth.service';

@Injectable()
export class ContactHandler {
    constructor(
        private readonly logger: BotLoggerService,
        private readonly authService: AuthService,
    ) {}

    async handle(ctx: Context): Promise<void> {
        if (!ctx.message?.contact || !ctx.from) {
            return;
        }

        this.logger.messageReceived(ctx);
        await this.authService.handleContact(ctx);
    }

    async handleConsentResponse(ctx: Context): Promise<void> {
        if (!ctx.callbackQuery?.data) return;

        this.logger.callbackReceived(ctx, ctx.callbackQuery.data);
        await this.authService.handleConsentResponse(ctx);
    }
}

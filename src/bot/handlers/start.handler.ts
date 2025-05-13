import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { AuthService } from '../services/auth.service';
import { BotLoggerService } from '../services/bot-logger.service';

@Injectable()
export class StartHandler {
    constructor(
        private readonly logger: BotLoggerService,
        private readonly authService: AuthService,
    ) {}

    async handle(ctx: Context): Promise<void> {
        if (ctx.message?.text) {
            this.logger.commandReceived(ctx, ctx.message.text);
        }

        const isRegistered = await this.authService.checkRegistration(ctx);
        if (!isRegistered) {
            await this.authService.sendConsentPrompt(ctx);
        }
    }
}

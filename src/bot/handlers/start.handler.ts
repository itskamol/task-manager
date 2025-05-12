import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { BotLoggerService } from '../bot-logger.service';
import { AuthService } from '../auth.service';

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
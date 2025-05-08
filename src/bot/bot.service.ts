import { Injectable, OnModuleInit, OnApplicationShutdown, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';

@Injectable()
export class BotService implements OnModuleInit, OnApplicationShutdown {
  private readonly bot: Bot;
  private readonly logger = new Logger(BotService.name);

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not defined');
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }
    
    this.bot = new Bot(token);
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.bot.catch((err) => {
      this.logger.error('Error in Telegram bot:', err);
    });
  }

  private setupCommands(): void {
    this.bot.command('start', async (ctx: Context) => {
      try {
        await ctx.reply('Salom! Task Manager botga xush kelibsiz!');
      } catch (error) {
        this.logger.error('Error sending start message:', error);
        await ctx.reply('Sorry, an error occurred. Please try again later.');
      }
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      this.setupCommands();
      await this.bot.start({
        onStart: () => this.logger.log('Telegram bot started successfully'),
      });
    } catch (error) {
      this.logger.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.bot.stop();
      this.logger.log('Telegram bot stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping Telegram bot:', error);
    }
  }
}

import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { BotLoggerService } from './bot-logger.service';
import { BotCommandRegistryService } from './bot-command-registry.service'; // Import the new service

@Injectable()
export class BotService implements OnModuleInit, OnApplicationShutdown {
    private readonly bot: Bot;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: BotLoggerService,
        private readonly commandRegistryService: BotCommandRegistryService, // Inject the new service
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

        if (!token) {
            this.logger.botError(undefined, new Error('TELEGRAM_BOT_TOKEN is not defined'));
            throw new Error('TELEGRAM_BOT_TOKEN is not defined');
        }

        this.bot = new Bot(token);
        this.setupErrorHandling();
    }

    private setupErrorHandling(): void {
        this.bot.catch((err) => {
            this.logger.botError(undefined, err);
        });
    }

    async onModuleInit(): Promise<void> {
        try {
            // Setup command handlers first
            this.commandRegistryService.setupHandlers(this.bot);

            // Register visible commands with Telegram
            await this.commandRegistryService.registerCommands(this.bot);

            // Start the bot
            await this.bot.start({
                onStart: () => this.logger.botStarted(),
            });
        } catch (error) {
            this.logger.botError(undefined, error as Error);
            throw error;
        }
    }

    async onApplicationShutdown(): Promise<void> {
        try {
            await this.bot.stop();
            this.logger.botStopped();
        } catch (error) {
            this.logger.botError(undefined, error as Error);
        }
    }
}

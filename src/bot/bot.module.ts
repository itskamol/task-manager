import { Module } from '@nestjs/common';
import { BotService } from './services/bot.service';
import { AuthService } from './services/auth.service';
import { StartHandler } from './handlers/start.handler';
import { ContactHandler } from './handlers/contact.handler';
import { TasksModule } from '../tasks/tasks.module';
import { BotCommandRegistryService } from './services/bot-command-registry.service'; // Import the new service
import { BotLoggerService } from './services/bot-logger.service'; // Import BotLoggerService

@Module({
    imports: [TasksModule],
    providers: [
        BotService,
        AuthService,
        StartHandler,
        ContactHandler,
        BotCommandRegistryService, // Add the new service
        BotLoggerService, // Add BotLoggerService
    ],
})
export class BotModule {}

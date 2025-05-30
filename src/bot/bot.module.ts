import { Module } from '@nestjs/common';
import { BotService } from './services/bot.service';
import { AuthService } from './services/auth.service';
import { StartHandler } from './handlers/start.handler';
import { ContactHandler } from './handlers/contact.handler';
import { HelpHandler } from './handlers/help.handler';
import { ConversationHandlers } from './handlers/conversation.handler';
import { MessageHandler } from './handlers/message.handler';
import { TasksModule } from '../tasks/tasks.module';
import { ReportsModule } from '../reports/reports.module';
import { AiModule } from '../ai/ai.module';
import { BotCommandRegistryService } from './services/bot-command-registry.service';
import { BotLoggerService } from './services/bot-logger.service';
import { SessionService } from './services/session.service';

@Module({
    imports: [TasksModule, ReportsModule, AiModule],
    providers: [
        BotService,
        AuthService,
        StartHandler,
        ContactHandler,
        HelpHandler,
        ConversationHandlers,
        MessageHandler,
        SessionService,
        BotCommandRegistryService,
        BotLoggerService,
    ],
    exports: [AuthService, BotService, BotCommandRegistryService, BotLoggerService, SessionService],
})
export class BotModule {}

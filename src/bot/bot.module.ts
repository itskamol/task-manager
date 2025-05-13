import { Module } from '@nestjs/common';
import { BotService } from './services/bot.service';
import { AuthService } from './services/auth.service';
import { StartHandler } from './handlers/start.handler';
import { ContactHandler } from './handlers/contact.handler';
import { TasksModule } from '../tasks/tasks.module';

@Module({
    imports: [TasksModule],
    providers: [BotService, AuthService, StartHandler, ContactHandler],
})
export class BotModule {}

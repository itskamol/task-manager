import { Module, forwardRef } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksHandler } from './handlers/tasks.handler';
import { AiModule } from '../ai/ai.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { BotModule } from '../bot/bot.module';

@Module({
    imports: [
        AiModule,
        SchedulerModule,
        forwardRef(() => BotModule), // Use forwardRef to avoid circular dependency
    ],
    providers: [TasksService, TasksHandler],
    exports: [TasksService, TasksHandler],
})
export class TasksModule {}

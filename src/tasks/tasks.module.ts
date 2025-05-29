import { Module, forwardRef } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksHandler } from './handlers/tasks.handler';
import { InteractiveTaskHandler } from './handlers/interactive-task.handler';
import { SessionService } from '../bot/services/session.service';
import { AiModule } from '../ai/ai.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { BotModule } from '../bot/bot.module';
// import { UsersModule } from  '../';

@Module({
    imports: [
        AiModule,
        SchedulerModule,
        // UsersModule,
        forwardRef(() => BotModule),
        // Use forwardRef to avoid circular dependency
    ],
    providers: [TasksService, TasksHandler, InteractiveTaskHandler, SessionService],
    exports: [TasksService, TasksHandler, InteractiveTaskHandler, SessionService],
})
export class TasksModule {}

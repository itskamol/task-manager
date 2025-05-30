import { Module, forwardRef } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksHandler } from './handlers/tasks.handler';
import { InteractiveTaskHandler } from './handlers/interactive-task.handler';
import { SessionService } from '../bot/services/session.service';
import { UserService } from '../common/services/user.service';
import { AiModule } from '../ai/ai.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { BotModule } from '../bot/bot.module';

@Module({
    imports: [
        AiModule,
        SchedulerModule,
        forwardRef(() => BotModule),
        // Use forwardRef to avoid circular dependency
    ],
    providers: [TasksService, TasksHandler, InteractiveTaskHandler, SessionService, UserService],
    exports: [TasksService, TasksHandler, InteractiveTaskHandler, SessionService, UserService],
})
export class TasksModule {}

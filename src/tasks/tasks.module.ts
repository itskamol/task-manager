import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksHandler } from './handlers/tasks.handler';
import { AiModule } from '../ai/ai.module';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
    imports: [AiModule, SchedulerModule],
    providers: [TasksService, TasksHandler],
    exports: [TasksService, TasksHandler],
})
export class TasksModule {}

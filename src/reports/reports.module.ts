import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsHandler } from './handlers/reports.handler';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [AiModule],
    providers: [ReportsService, ReportsHandler],
    exports: [ReportsService, ReportsHandler],
})
export class ReportsModule {}

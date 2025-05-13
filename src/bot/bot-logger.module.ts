import { Global, Module } from '@nestjs/common';
import { BotLoggerService } from './services/bot-logger.service';

@Global()
@Module({
    providers: [BotLoggerService],
    exports: [BotLoggerService],
})
export class BotLoggerModule {}

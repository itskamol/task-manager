import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston/dist/winston.utilities';

const errorFormat = winston.format((info) => {
  if (info.error instanceof Error) {
    const error = info.error;
    info.stack = error.stack;
    if (error.name === 'ZodError' && 'issues' in error) {
      info.validation = (error as any).issues;
      delete info.error;
    }
  }
  return info;
});

export const loggerConfig: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        errorFormat(),
        nestWinstonModuleUtilities.format.nestLike('TaskManager', {
          prettyPrint: true,
          colors: true,
        }),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        errorFormat(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        errorFormat(),
        winston.format.json(),
      ),
    }),
  ],
};

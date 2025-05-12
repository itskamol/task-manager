import { Context } from 'grammy';

export type CommandHandler = (ctx: Context) => Promise<void>;

export interface BotCommand {
  command: string;
  description: string;
  handler: CommandHandler;
}

export interface TaskCreationData {
  title: string;
  description?: string;
  deadline?: Date;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  repeat?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  estimatedTime?: number;
}
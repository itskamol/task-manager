import { Context } from 'grammy';

// Command categories
export type CommandCategory = 'core' | 'task' | 'report' | 'help';

// Handler function type
export type CommandHandler = (ctx: Context) => Promise<void>;

// Base command interface
export interface BotCommand {
    command: string;
    description: string;
    category: CommandCategory;
    handler: CommandHandler;
    isVisible?: boolean; // Whether to show in setMyCommands()
}

// Grouped commands interface for better organization
export interface CommandGroup {
    category: CommandCategory;
    title: string;
    emoji: string;
    commands: BotCommand[];
}

// Telegram command interface for setMyCommands API
export interface TelegramCommand {
    command: string;
    description: string;
}

// Task creation data interface
export interface TaskCreationData {
    title: string;
    description?: string;
    deadline?: Date;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    repeat?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    estimatedTime?: number;
}

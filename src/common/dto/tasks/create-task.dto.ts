import { Priority, Repeat } from '@prisma/client';

export class CreateTaskDto {
    title: string;
    description?: string;
    deadline?: string; // ISO string from frontend or Telegram (user TZ)
    timezone: string; // e.g. "Asia/Tashkent"
    priority?: Priority;
    repeat?: Repeat;
    estimatedTime?: number;
}

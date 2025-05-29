import { Priority } from '@prisma/client';

export interface UserSession {
    userId: string;
    chatId: number;
    state: SessionState;
    data: {
        taskTitle?: string;
        taskDescription?: string;
        priority?: Priority;
        estimatedTime?: number;
        deadline?: Date;
        questions?: string[];
        currentQuestionIndex?: number;
        lastQuestionAnswer?: string;
    };
    lastActivity: Date;
}

export enum SessionState {
    IDLE = 'idle',
    CREATING_TASK = 'creating_task',
    ASKING_DETAILS = 'asking_details',
    CONFIRMING_TASK = 'confirming_task',
    EDITING_TASK = 'editing_task',
}

export interface TaskCreationData {
    title: string;
    description?: string;
    priority?: Priority;
    estimatedTime?: number;
    deadline?: Date;
    timezone?: string;
}

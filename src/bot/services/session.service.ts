import { Injectable } from '@nestjs/common';
import { SessionState, UserSession } from '../interfaces/session.interface';
import { LoggerService } from '../../common/services/logger.service';

@Injectable()
export class SessionService {
    private sessions = new Map<string, UserSession>();

    constructor(private readonly logger: LoggerService) {
        // Clean up old sessions every 30 minutes
        setInterval(() => this.cleanupOldSessions(), 30 * 60 * 1000);
    }

    getSession(userId: string, chatId: number): UserSession {
        const sessionKey = `${userId}-${chatId}`;

        if (!this.sessions.has(sessionKey)) {
            const newSession: UserSession = {
                userId,
                chatId,
                state: SessionState.IDLE,
                data: {},
                lastActivity: new Date(),
            };
            this.sessions.set(sessionKey, newSession);
            this.logger.debug(`Created new session for user ${userId}`);
        }

        const session = this.sessions.get(sessionKey)!;
        session.lastActivity = new Date();
        return session;
    }

    updateSession(userId: string, chatId: number, updates: Partial<UserSession>): UserSession {
        const sessionKey = `${userId}-${chatId}`;
        const session = this.getSession(userId, chatId);

        // Deep merge the data object
        if (updates.data) {
            session.data = { ...session.data, ...updates.data };
            delete updates.data;
        }

        Object.assign(session, updates);
        session.lastActivity = new Date();

        this.sessions.set(sessionKey, session);
        this.logger.debug(`Updated session for user ${userId}, state: ${session.state}`);
        return session;
    }

    updateSessionData(
        userId: string,
        chatId: number,
        dataUpdates: Partial<UserSession['data']>,
    ): UserSession {
        const session = this.getSession(userId, chatId);
        session.data = { ...session.data, ...dataUpdates };
        session.lastActivity = new Date();

        const sessionKey = `${userId}-${chatId}`;
        this.sessions.set(sessionKey, session);
        return session;
    }

    clearSession(userId: string, chatId: number): void {
        const sessionKey = `${userId}-${chatId}`;
        this.sessions.delete(sessionKey);
        this.logger.debug(`Cleared session for user ${userId}`);
    }

    isUserInSession(userId: string, chatId: number): boolean {
        const session = this.getSession(userId, chatId);
        return session.state !== SessionState.IDLE;
    }

    getSessionState(userId: string, chatId: number): SessionState {
        const session = this.getSession(userId, chatId);
        return session.state;
    }

    // Clean up old sessions (older than 2 hours)
    private cleanupOldSessions(): void {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        let cleanedCount = 0;

        for (const [key, session] of this.sessions.entries()) {
            if (session.lastActivity < twoHoursAgo) {
                this.sessions.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.debug(`Cleaned up ${cleanedCount} old sessions`);
        }
    }

    // Debug method to get session count
    getActiveSessionCount(): number {
        return this.sessions.size;
    }
}

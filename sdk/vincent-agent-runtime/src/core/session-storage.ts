import type { SessionState, SessionStorage } from '../types/session';

export class InMemorySessionStorage implements SessionStorage {
    private storage: Map<string, SessionState> = new Map();

    async save(session: SessionState): Promise<void> {
        this.storage.set(session.sessionId, session);
    }

    async load(sessionId: string): Promise<SessionState | null> {
        return this.storage.get(sessionId) || null;
    }

    async update(sessionId: string, updates: Partial<SessionState>): Promise<void> {
        const session = this.storage.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const updatedSession = { ...session, ...updates };
        this.storage.set(sessionId, updatedSession);
    }

    async delete(sessionId: string): Promise<void> {
        this.storage.delete(sessionId);
    }

    async list(agentId?: string): Promise<SessionState[]> {
        const sessions = Array.from(this.storage.values());

        if (agentId) {
            return sessions.filter(session => session.agentId === agentId);
        }

        return sessions;
    }
}

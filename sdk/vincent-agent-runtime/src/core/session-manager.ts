import { v4 as uuidv4 } from 'uuid';
import type { 
  SessionManager, 
  SessionState, 
  SessionConfig, 
  SessionStorage 
} from '../types/session';

export class InMemorySessionManager implements SessionManager {
  private storage: SessionStorage;
  private sessions: Map<string, SessionState> = new Map();

  constructor(storage: SessionStorage) {
    this.storage = storage;
  }

  async createSession(config: SessionConfig): Promise<SessionState> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();
    
    const session: SessionState = {
      sessionId,
      agentId: config.agentId,
      delegatorId: config.delegatorId,
      status: 'active',
      createdAt: now,
      lastActivityAt: now,
      expiresAt: config.sessionTimeout 
        ? new Date(Date.now() + config.sessionTimeout * 1000).toISOString()
        : undefined,
      totalSpent: '0',
      remainingBudget: config.maxBudget || '1000000', // Default 1 USDC
      requestCount: 0,
      policyViolations: [],
      metadata: config.metadata,
    };

    this.sessions.set(sessionId, session);
    await this.storage.save(session);
    
    return session;
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    // Try memory first
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Fallback to storage
      session = await this.storage.load(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }
    
    return session;
  }

  async updateSession(sessionId: string, updates: Partial<SessionState>): Promise<SessionState> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updatedSession = {
      ...session,
      ...updates,
      lastActivityAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, updatedSession);
    await this.storage.update(sessionId, updates);
    
    return updatedSession;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const terminatedSession = {
      ...session,
      status: 'terminated' as const,
      lastActivityAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, terminatedSession);
    await this.storage.update(sessionId, { status: 'terminated' });
  }

  async listSessions(agentId?: string): Promise<SessionState[]> {
    if (agentId) {
      return Array.from(this.sessions.values()).filter(
        session => session.agentId === agentId
      );
    }
    return Array.from(this.sessions.values());
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt && new Date(session.expiresAt) < now) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.terminateSession(sessionId);
    }
  }
}

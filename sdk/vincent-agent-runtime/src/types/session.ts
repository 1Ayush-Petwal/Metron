import { z } from 'zod';
import type { VincentClientConfig } from '@metron/vincent-policy-engine';
import type { Signer, MultiNetworkSigner } from 'x402/types';

// Session Configuration
export const SessionConfigSchema = z.object({
    agentId: z.string().uuid(),
    delegatorId: z.string(),
    walletClient: z.any(), // Signer | MultiNetworkSigner
    vincentConfig: z.any(), // VincentClientConfig
    maxBudget: z.string().optional(),
    sessionTimeout: z.number().positive().optional(),
    metadata: z.record(z.any()).optional(),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

// Session State
export const SessionStateSchema = z.object({
    sessionId: z.string().uuid(),
    agentId: z.string().uuid(),
    delegatorId: z.string(),
    status: z.enum(['active', 'paused', 'expired', 'terminated']),
    createdAt: z.string().datetime(),
    lastActivityAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    totalSpent: z.string(),
    remainingBudget: z.string(),
    requestCount: z.number().nonnegative(),
    policyViolations: z.array(z.string()),
    metadata: z.record(z.any()).optional(),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

// Session Events
export const SessionEventSchema = z.object({
    type: z.enum(['created', 'request_executed', 'budget_exceeded', 'policy_violation', 'expired', 'terminated']),
    sessionId: z.string().uuid(),
    timestamp: z.string().datetime(),
    data: z.record(z.any()).optional(),
});

export type SessionEvent = z.infer<typeof SessionEventSchema>;

// Session Manager Interface
export interface SessionManager {
    createSession(config: SessionConfig): Promise<SessionState>;
    getSession(sessionId: string): Promise<SessionState | null>;
    updateSession(sessionId: string, updates: Partial<SessionState>): Promise<SessionState>;
    terminateSession(sessionId: string): Promise<void>;
    listSessions(agentId?: string): Promise<SessionState[]>;
    cleanupExpiredSessions(): Promise<void>;
}

// Session Storage Interface
export interface SessionStorage {
    save(session: SessionState): Promise<void>;
    load(sessionId: string): Promise<SessionState | null>;
    update(sessionId: string, updates: Partial<SessionState>): Promise<void>;
    delete(sessionId: string): Promise<void>;
    list(agentId?: string): Promise<SessionState[]>;
}

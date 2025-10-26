import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVincentAgentRuntime } from '../core/agent-runtime';
import { VincentSigningService } from '../core/signing-service';
import type { VincentClientConfig } from '@metron/vincent-policy-engine';
import type { Signer } from 'x402/types';

// Mock implementations
const mockWalletClient: Signer = {} as Signer;

const mockVincentConfig: VincentClientConfig = {
    network: 'ethereum',
    rpcUrl: 'https://mainnet.infura.io/v3/test',
    privateKey: 'test-private-key',
    publicKey: 'test-public-key',
    did: 'did:hedera:test-did',
};

const mockPolicyEngine = {
    evaluatePolicy: vi.fn().mockResolvedValue({
        allowed: true,
        reason: undefined,
        remainingAmount: '1000000',
        resetTime: undefined,
        violations: undefined,
    }),
};

describe('VincentAgentRuntime', () => {
    let runtime: ReturnType<typeof createVincentAgentRuntime>;

    beforeEach(() => {
        const signingService = new VincentSigningService({
            walletClient: mockWalletClient,
            vincentConfig: mockVincentConfig,
            signingMethod: 'vincent',
        });

        runtime = createVincentAgentRuntime({
            signingService,
            policyEngine: mockPolicyEngine as any,
        });
    });

    describe('Session Management', () => {
        it('should create a session', async () => {
            const session = await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
                maxBudget: '1000000',
            });

            expect(session).toBeDefined();
            expect(session.agentId).toBe('agent-123');
            expect(session.delegatorId).toBe('delegator-456');
            expect(session.status).toBe('active');
            expect(session.remainingBudget).toBe('1000000');
        });

        it('should get a session', async () => {
            const session = await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
            });

            const retrievedSession = await runtime.getSession(session.sessionId);
            expect(retrievedSession).toEqual(session);
        });

        it('should list sessions', async () => {
            await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
            });

            const sessions = await runtime.listSessions();
            expect(sessions).toHaveLength(1);
        });

        it('should end a session', async () => {
            const session = await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
            });

            await runtime.endSession(session.sessionId);

            const endedSession = await runtime.getSession(session.sessionId);
            expect(endedSession?.status).toBe('terminated');
        });
    });

    describe('Budget Management', () => {
        it('should get remaining budget', async () => {
            const session = await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
                maxBudget: '5000000',
            });

            const remainingBudget = await runtime.getRemainingBudget(session.sessionId);
            expect(remainingBudget).toBe('5000000');
        });

        it('should update budget', async () => {
            const session = await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
                maxBudget: '1000000',
            });

            await runtime.updateBudget(session.sessionId, '2000000');
            const remainingBudget = await runtime.getRemainingBudget(session.sessionId);
            expect(remainingBudget).toBe('2000000');
        });
    });

    describe('Request Execution', () => {
        it('should execute a request successfully', async () => {
            const session = await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
                maxBudget: '1000000',
            });

            // Mock fetch to return a successful response
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: 'test' }),
            });

            const result = await runtime.executeRequest(session.sessionId, {
                sessionId: session.sessionId,
                url: 'https://api.example.com/test',
                method: 'GET',
            });

            expect(result.success).toBe(true);
            expect(result.cost).toBeDefined();
        });

        it('should handle policy violations', async () => {
            const session = await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
            });

            // Mock policy engine to return a violation
            mockPolicyEngine.evaluatePolicy.mockResolvedValueOnce({
                allowed: false,
                reason: 'Policy violation',
                violations: [{
                    type: 'spending_limit',
                    message: 'Amount exceeds limit',
                    severity: 'high',
                }],
            });

            const result = await runtime.executeRequest(session.sessionId, {
                sessionId: session.sessionId,
                url: 'https://api.example.com/test',
                method: 'GET',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Policy violation');
        });
    });

    describe('Event Handling', () => {
        it('should emit session events', async () => {
            const eventCallback = vi.fn();
            runtime.onSessionEvent(eventCallback);

            await runtime.initSession({
                agentId: 'agent-123',
                delegatorId: 'delegator-456',
                walletClient: mockWalletClient,
                vincentConfig: mockVincentConfig,
            });

            expect(eventCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'session_created',
                    sessionId: expect.any(String),
                })
            );
        });
    });
});

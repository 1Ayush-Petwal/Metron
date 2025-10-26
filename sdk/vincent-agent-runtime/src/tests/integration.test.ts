import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVincentAgentRuntime } from '../core/agent-runtime';
import { VincentSigningService } from '../core/signing-service';
import type { VincentClientConfig } from '@metron/vincent-policy-engine';
import type { Signer } from 'x402/types';

// Mock implementations
const mockWalletClient: Signer = {
  // Mock wallet client implementation
} as Signer;

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

describe('Vincent Agent Runtime Integration', () => {
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

  it('should complete a full agent workflow', async () => {
    // 1. Initialize session
    const session = await runtime.initSession({
      agentId: 'agent-123',
      delegatorId: 'delegator-456',
      walletClient: mockWalletClient,
      vincentConfig: mockVincentConfig,
      maxBudget: '1000000',
      sessionTimeout: 3600,
      metadata: {
        name: 'Test Agent',
        version: '1.0.0',
      },
    });

    expect(session).toBeDefined();
    expect(session.status).toBe('active');
    expect(session.remainingBudget).toBe('1000000');

    // 2. Check initial budget
    const initialBudget = await runtime.getRemainingBudget(session.sessionId);
    expect(initialBudget).toBe('1000000');

    // 3. Mock successful API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test response' }),
    });

    // 4. Execute a request
    const result = await runtime.executeRequest(session.sessionId, {
      sessionId: session.sessionId,
      url: 'https://api.example.com/test',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      metadata: {
        requestId: 'req-123',
      },
    });

    expect(result.success).toBe(true);
    expect(result.cost).toBeDefined();
    expect(parseInt(result.cost)).toBeGreaterThan(0);

    // 5. Check updated budget
    const updatedBudget = await runtime.getRemainingBudget(session.sessionId);
    expect(parseInt(updatedBudget)).toBeLessThan(parseInt(initialBudget));

    // 6. Get metering data
    const meteringData = await runtime.getMeteringData(session.sessionId);
    expect(meteringData.requestCount).toBe(1);
    expect(meteringData.totalSpent).toBe(result.cost);

    // 7. List sessions
    const sessions = await runtime.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe(session.sessionId);

    // 8. End session
    await runtime.endSession(session.sessionId);
    const endedSession = await runtime.getSession(session.sessionId);
    expect(endedSession?.status).toBe('terminated');
  });

  it('should handle policy violations', async () => {
    const session = await runtime.initSession({
      agentId: 'agent-123',
      delegatorId: 'delegator-456',
      walletClient: mockWalletClient,
      vincentConfig: mockVincentConfig,
      maxBudget: '1000000',
    });

    // Mock policy engine to return a violation
    mockPolicyEngine.evaluatePolicy.mockResolvedValueOnce({
      allowed: false,
      reason: 'Amount exceeds spending limit',
      violations: [{
        type: 'spending_limit',
        message: 'Requested amount exceeds daily limit',
        severity: 'high',
      }],
    });

    const result = await runtime.executeRequest(session.sessionId, {
      sessionId: session.sessionId,
      url: 'https://api.example.com/expensive',
      method: 'POST',
      body: JSON.stringify({ data: 'large request' }),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Amount exceeds spending limit');
    expect(result.cost).toBe('0');
  });

  it('should handle budget exceeded scenarios', async () => {
    const session = await runtime.initSession({
      agentId: 'agent-123',
      delegatorId: 'delegator-456',
      walletClient: mockWalletClient,
      vincentConfig: mockVincentConfig,
      maxBudget: '1000', // Very small budget
    });

    // Mock a high-cost request
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const result = await runtime.executeRequest(session.sessionId, {
      sessionId: session.sessionId,
      url: 'https://api.example.com/expensive',
      method: 'POST',
    });

    // Should fail due to budget constraints
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient budget');
  });

  it('should emit events correctly', async () => {
    const eventCallback = vi.fn();
    runtime.onSessionEvent(eventCallback);

    const session = await runtime.initSession({
      agentId: 'agent-123',
      delegatorId: 'delegator-456',
      walletClient: mockWalletClient,
      vincentConfig: mockVincentConfig,
    });

    // Should emit session created event
    expect(eventCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'session_created',
        sessionId: session.sessionId,
      })
    );

    // Mock successful request
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    await runtime.executeRequest(session.sessionId, {
      sessionId: session.sessionId,
      url: 'https://api.example.com/test',
      method: 'GET',
    });

    // Should emit request executed event
    expect(eventCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'request_executed',
        sessionId: session.sessionId,
      })
    );

    await runtime.endSession(session.sessionId);

    // Should emit session terminated event
    expect(eventCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'session_terminated',
        sessionId: session.sessionId,
      })
    );
  });
});

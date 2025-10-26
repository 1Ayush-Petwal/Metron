#!/usr/bin/env tsx

/**
 * Simple Agent Example
 * 
 * This example demonstrates how to use the Vincent Agent Runtime
 * to create an agent that can make paid API requests under Vincent policies.
 */

import { createVincentAgentRuntime } from '../src/core/agent-runtime';
import { VincentSigningService } from '../src/core/signing-service';
import type { VincentClientConfig } from '@metron/vincent-policy-engine';
import type { Signer } from 'x402/types';

// Mock wallet client (in a real implementation, this would be a proper wallet)
const mockWalletClient: Signer = {
  // Mock implementation - in reality this would be a proper wallet
} as Signer;

// Mock Vincent configuration
const vincentConfig: VincentClientConfig = {
  network: 'ethereum',
  rpcUrl: 'https://mainnet.infura.io/v3/your-key',
  privateKey: 'mock-private-key',
  publicKey: 'mock-public-key',
  did: 'did:hedera:mock-did',
};

// Mock policy engine (in a real implementation, this would be the actual policy engine)
const mockPolicyEngine = {
  evaluatePolicy: async () => ({
    allowed: true,
    reason: undefined,
    remainingAmount: '1000000',
    resetTime: undefined,
    violations: undefined,
  }),
};

async function runSimpleAgent() {
  console.log('🤖 Starting Simple Agent Example...\n');

  try {
    // Create signing service
    const signingService = new VincentSigningService({
      walletClient: mockWalletClient,
      vincentConfig,
      signingMethod: 'vincent',
    });

    // Create runtime
    const runtime = createVincentAgentRuntime({
      signingService,
      policyEngine: mockPolicyEngine as any,
    });

    // Set up event listeners
    runtime.onSessionEvent((event) => {
      console.log(`📡 Event: ${event.type}`, {
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        data: event.data,
      });
    });

    // Initialize agent session
    console.log('🔐 Initializing agent session...');
    const session = await runtime.initSession({
      agentId: 'simple-agent-001',
      delegatorId: 'delegator-123',
      walletClient: mockWalletClient,
      vincentConfig,
      maxBudget: '5000000', // 5 USDC
      sessionTimeout: 3600, // 1 hour
      metadata: {
        name: 'Simple Agent',
        version: '1.0.0',
        description: 'A simple agent for demonstration',
      },
    });

    console.log('✅ Session created:', {
      sessionId: session.sessionId,
      agentId: session.agentId,
      status: session.status,
      remainingBudget: session.remainingBudget,
    });

    // Check initial budget
    const initialBudget = await runtime.getRemainingBudget(session.sessionId);
    console.log(`💰 Initial budget: ${initialBudget} microUSDC`);

    // Mock some API requests
    const requests = [
      {
        url: 'https://api.example.com/data',
        method: 'GET',
        description: 'Fetch user data',
      },
      {
        url: 'https://api.example.com/process',
        method: 'POST',
        body: { action: 'process', data: 'test' },
        description: 'Process data',
      },
      {
        url: 'https://api.example.com/analyze',
        method: 'POST',
        body: { query: 'analyze trends' },
        description: 'Analyze trends',
      },
    ];

    // Mock fetch to simulate API responses
    global.fetch = async (url: string, init?: RequestInit) => {
      console.log(`🌐 Making request to: ${url}`);
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: `Response from ${url}`,
          timestamp: new Date().toISOString(),
        }),
      } as Response;
    };

    // Execute requests
    for (const [index, request] of requests.entries()) {
      console.log(`\n📤 Executing request ${index + 1}: ${request.description}`);
      
      const result = await runtime.executeRequest(session.sessionId, {
        sessionId: session.sessionId,
        url: request.url,
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        metadata: {
          requestId: `req-${index + 1}`,
          description: request.description,
        },
      });

      if (result.success) {
        console.log(`✅ Request successful:`, {
          cost: result.cost,
          response: result.response,
        });
      } else {
        console.log(`❌ Request failed:`, {
          error: result.error,
          cost: result.cost,
        });
      }

      // Check remaining budget
      const remainingBudget = await runtime.getRemainingBudget(session.sessionId);
      console.log(`💰 Remaining budget: ${remainingBudget} microUSDC`);
    }

    // Get final metering data
    console.log('\n📊 Final metering data:');
    const meteringData = await runtime.getMeteringData(session.sessionId);
    console.log({
      totalSpent: meteringData.totalSpent,
      remainingBudget: meteringData.remainingBudget,
      requestCount: meteringData.requestCount,
      averageCost: meteringData.averageCost,
      lastRequestAt: meteringData.lastRequestAt,
    });

    // List all sessions
    console.log('\n📋 All sessions:');
    const allSessions = await runtime.listSessions();
    allSessions.forEach(session => {
      console.log({
        sessionId: session.sessionId,
        agentId: session.agentId,
        status: session.status,
        requestCount: session.requestCount,
        totalSpent: session.totalSpent,
      });
    });

    // End session
    console.log('\n🔚 Ending session...');
    await runtime.endSession(session.sessionId);
    console.log('✅ Session ended successfully');

  } catch (error) {
    console.error('❌ Error running simple agent:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  runSimpleAgent().catch(console.error);
}

export { runSimpleAgent };

import { createVincentAgentRuntime } from '../core/agent-runtime';
import { VincentSigningService } from '../core/signing-service';
import type { VincentClientConfig } from '@metron/vincent-policy-engine';
import type { Signer } from 'x402/types';

// Example usage of the Vincent Agent Runtime
export async function basicUsageExample() {
    // Mock wallet client (in real usage, this would be a proper wallet)
    const mockWalletClient: Signer = {
        // Mock implementation
    } as Signer;

    // Mock Vincent config
    const vincentConfig: VincentClientConfig = {
        network: 'ethereum',
        rpcUrl: 'https://mainnet.infura.io/v3/your-key',
        privateKey: 'mock-private-key',
        publicKey: 'mock-public-key',
        did: 'did:hedera:mock-did',
    };

    // Create signing service
    const signingService = new VincentSigningService({
        walletClient: mockWalletClient,
        vincentConfig,
        signingMethod: 'vincent',
    });

    // Create runtime
    const runtime = createVincentAgentRuntime({
        signingService,
        // policyEngine would be injected in real usage
    });

    // Initialize a session
    const session = await runtime.initSession({
        agentId: 'agent-123',
        delegatorId: 'delegator-456',
        walletClient: mockWalletClient,
        vincentConfig,
        maxBudget: '5000000', // 5 USDC
        sessionTimeout: 7200, // 2 hours
        metadata: {
            name: 'Example Agent',
            version: '1.0.0',
        },
    });

    console.log('Session created:', session);

    // Execute a request
    const result = await runtime.executeRequest(session.sessionId, {
        sessionId: session.sessionId,
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        metadata: {
            requestId: 'req-123',
        },
    });

    console.log('Request result:', result);

    // Get remaining budget
    const remainingBudget = await runtime.getRemainingBudget(session.sessionId);
    console.log('Remaining budget:', remainingBudget);

    // Get metering data
    const meteringData = await runtime.getMeteringData(session.sessionId);
    console.log('Metering data:', meteringData);

    // End session
    await runtime.endSession(session.sessionId);
    console.log('Session ended');
}

// Example with event handling
export async function eventHandlingExample() {
    const runtime = createVincentAgentRuntime({
        // ... config
    });

    // Listen for events
    runtime.onSessionEvent((event) => {
        console.log('Session event:', event);
    });

    // ... rest of the usage
}

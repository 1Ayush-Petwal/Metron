#!/usr/bin/env tsx

/**
 * Policy Integration Example
 * 
 * This example demonstrates how to integrate with Vincent policies
 * and handle policy violations in the agent runtime.
 */

import { createVincentAgentRuntime } from '../src/core/agent-runtime';
import { VincentSigningService } from '../src/core/signing-service';
import type { VincentClientConfig } from '@metron/vincent-policy-engine';
import type { Signer } from 'x402/types';

// Mock wallet client
const mockWalletClient: Signer = {} as Signer;

// Mock Vincent configuration
const vincentConfig: VincentClientConfig = {
    network: 'ethereum',
    rpcUrl: 'https://mainnet.infura.io/v3/your-key',
    privateKey: 'mock-private-key',
    publicKey: 'mock-public-key',
    did: 'did:hedera:mock-did',
};

// Mock policy engine with different policy scenarios
const mockPolicyEngine = {
    evaluatePolicy: async (policyDef: any, context: any) => {
        const { amount, endpoint } = context.abilityParams;
        const { maxAmount } = context.userParams;

        console.log(`🔍 Evaluating policy:`, {
            policyId: policyDef.id,
            requestedAmount: amount,
            maxAmount,
            endpoint,
        });

        // Simulate different policy outcomes based on the request
        if (BigInt(amount) > BigInt(maxAmount)) {
            return {
                allowed: false,
                reason: 'Amount exceeds maximum allowed',
                violations: [{
                    type: 'spending_limit',
                    message: `Requested ${amount} exceeds limit of ${maxAmount}`,
                    severity: 'high',
                }],
            };
        }

        if (endpoint.includes('/admin/')) {
            return {
                allowed: false,
                reason: 'Access denied to admin endpoints',
                violations: [{
                    type: 'access_control',
                    message: 'Admin endpoints are not allowed',
                    severity: 'critical',
                }],
            };
        }

        if (endpoint.includes('/expensive/')) {
            return {
                allowed: false,
                reason: 'Expensive endpoints require special permission',
                violations: [{
                    type: 'access_control',
                    message: 'Expensive endpoints require special permission',
                    severity: 'medium',
                }],
            };
        }

        // Allow the request
        const remainingAmount = (BigInt(maxAmount) - BigInt(amount)).toString();
        return {
            allowed: true,
            reason: undefined,
            remainingAmount,
            resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            violations: undefined,
        };
    },
};

async function runPolicyIntegrationExample() {
    console.log('🛡️ Starting Policy Integration Example...\n');

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
            if (event.type === 'policy_violation') {
                console.log(`🚨 Policy Violation:`, event.data);
            } else {
                console.log(`📡 Event: ${event.type}`, {
                    sessionId: event.sessionId,
                    data: event.data,
                });
            }
        });

        // Initialize agent session with strict budget
        console.log('🔐 Initializing agent session with strict policies...');
        const session = await runtime.initSession({
            agentId: 'policy-agent-001',
            delegatorId: 'delegator-456',
            walletClient: mockWalletClient,
            vincentConfig,
            maxBudget: '1000000', // 1 USDC - strict budget
            sessionTimeout: 1800, // 30 minutes
            metadata: {
                name: 'Policy-Aware Agent',
                version: '1.0.0',
                policies: ['spending_limit', 'access_control'],
            },
        });

        console.log('✅ Session created:', {
            sessionId: session.sessionId,
            agentId: session.agentId,
            status: session.status,
            remainingBudget: session.remainingBudget,
        });

        // Test different request scenarios
        const testRequests = [
            {
                url: 'https://api.example.com/data',
                method: 'GET',
                amount: '1000',
                description: 'Normal data request (should succeed)',
                expectedResult: 'success',
            },
            {
                url: 'https://api.example.com/expensive/process',
                method: 'POST',
                amount: '5000',
                description: 'Expensive endpoint (should fail - access control)',
                expectedResult: 'policy_violation',
            },
            {
                url: 'https://api.example.com/admin/users',
                method: 'GET',
                amount: '1000',
                description: 'Admin endpoint (should fail - access control)',
                expectedResult: 'policy_violation',
            },
            {
                url: 'https://api.example.com/process',
                method: 'POST',
                amount: '2000000',
                description: 'High amount request (should fail - spending limit)',
                expectedResult: 'policy_violation',
            },
            {
                url: 'https://api.example.com/analyze',
                method: 'POST',
                amount: '500000',
                description: 'Analysis request (should succeed)',
                expectedResult: 'success',
            },
        ];

        // Mock fetch
        global.fetch = async (url: string, init?: RequestInit) => {
            console.log(`🌐 Making request to: ${url}`);
            await new Promise(resolve => setTimeout(resolve, 50));

            return {
                ok: true,
                json: async () => ({
                    success: true,
                    data: `Response from ${url}`,
                    timestamp: new Date().toISOString(),
                }),
            } as Response;
        };

        // Execute test requests
        for (const [index, request] of testRequests.entries()) {
            console.log(`\n📤 Test ${index + 1}: ${request.description}`);
            console.log(`   URL: ${request.url}`);
            console.log(`   Amount: ${request.amount} microUSDC`);
            console.log(`   Expected: ${request.expectedResult}`);

            const result = await runtime.executeRequest(session.sessionId, {
                sessionId: session.sessionId,
                url: request.url,
                method: request.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount: request.amount }),
                metadata: {
                    requestId: `test-${index + 1}`,
                    description: request.description,
                    amount: request.amount,
                },
            });

            // Check if result matches expectation
            const actualResult = result.success ? 'success' : 'policy_violation';
            const matches = actualResult === request.expectedResult;

            console.log(`   Result: ${matches ? '✅' : '❌'} ${actualResult}`);

            if (result.success) {
                console.log(`   Cost: ${result.cost} microUSDC`);
                console.log(`   Response: ${JSON.stringify(result.response).substring(0, 100)}...`);
            } else {
                console.log(`   Error: ${result.error}`);
                if (result.policyResult?.violations) {
                    result.policyResult.violations.forEach((violation: any) => {
                        console.log(`   Violation: ${violation.type} - ${violation.message} (${violation.severity})`);
                    });
                }
            }

            // Check remaining budget
            const remainingBudget = await runtime.getRemainingBudget(session.sessionId);
            console.log(`   Remaining budget: ${remainingBudget} microUSDC`);
        }

        // Get final metering data
        console.log('\n📊 Final metering data:');
        const meteringData = await runtime.getMeteringData(session.sessionId);
        console.log({
            totalSpent: meteringData.totalSpent,
            remainingBudget: meteringData.remainingBudget,
            requestCount: meteringData.requestCount,
            averageCost: meteringData.averageCost,
            costBreakdown: meteringData.costBreakdown.map(record => ({
                requestId: record.requestId,
                cost: record.cost,
                endpoint: record.endpoint,
                method: record.method,
            })),
        });

        // Show policy violations
        const finalSession = await runtime.getSession(session.sessionId);
        if (finalSession?.policyViolations.length > 0) {
            console.log('\n🚨 Policy violations recorded:');
            finalSession.policyViolations.forEach((violation, index) => {
                console.log(`   ${index + 1}. ${violation}`);
            });
        }

        // End session
        console.log('\n🔚 Ending session...');
        await runtime.endSession(session.sessionId);
        console.log('✅ Session ended successfully');

    } catch (error) {
        console.error('❌ Error running policy integration example:', error);
        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    runPolicyIntegrationExample().catch(console.error);
}

export { runPolicyIntegrationExample };

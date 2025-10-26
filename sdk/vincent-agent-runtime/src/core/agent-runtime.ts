import { wrapFetchWithPayment } from 'x402-fetch';
import type {
    AgentRuntime,
    RuntimeConfig,
    SessionConfig,
    SessionState,
    RequestContext,
    RequestResult,
    RuntimeEvent
} from '../types/runtime';
import type { PolicyEvaluationResult } from '../types/policy';
import type { MeteringData } from '../types/metering';
import { InMemorySessionManager } from './session-manager';
import { InMemorySessionStorage } from './session-storage';
import { VincentPolicyManager } from './policy-manager';
import { InMemoryMeteringService } from './metering-service';
import { VincentSigningService } from './signing-service';

export class VincentAgentRuntime implements AgentRuntime {
    private config: RuntimeConfig;
    private eventListeners: Set<(event: RuntimeEvent) => void> = new Set();

    constructor(config: RuntimeConfig) {
        this.config = config;
    }

    async initSession(config: SessionConfig): Promise<SessionState> {
        try {
            const session = await this.config.sessionManager.createSession(config);

            this.emitEvent({
                type: 'session_created',
                sessionId: session.sessionId,
                timestamp: new Date().toISOString(),
                data: { agentId: session.agentId, delegatorId: session.delegatorId },
            });

            return session;
        } catch (error) {
            throw new Error(`Failed to initialize session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async endSession(sessionId: string): Promise<void> {
        try {
            await this.config.sessionManager.terminateSession(sessionId);

            this.emitEvent({
                type: 'session_terminated',
                sessionId,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            throw new Error(`Failed to end session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getSession(sessionId: string): Promise<SessionState | null> {
        return await this.config.sessionManager.getSession(sessionId);
    }

    async listSessions(agentId?: string): Promise<SessionState[]> {
        return await this.config.sessionManager.listSessions(agentId);
    }

    async executeRequest(sessionId: string, context: RequestContext): Promise<RequestResult> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            if (session.status !== 'active') {
                throw new Error(`Session ${sessionId} is not active`);
            }

            // Evaluate policies before execution
            const policyResult = await this.evaluatePolicies(sessionId, context);
            if (!policyResult.allowed) {
                return {
                    success: false,
                    error: policyResult.reason || 'Policy violation',
                    cost: '0',
                    policyResult,
                    timestamp: new Date().toISOString(),
                };
            }

            // Check budget
            const remainingBudget = await this.getRemainingBudget(sessionId);
            const estimatedCost = await this.estimateRequestCost(context);

            if (BigInt(estimatedCost) > BigInt(remainingBudget)) {
                this.emitEvent({
                    type: 'budget_exceeded',
                    sessionId,
                    timestamp: new Date().toISOString(),
                    data: { requestedAmount: estimatedCost, remainingBudget },
                });

                return {
                    success: false,
                    error: 'Insufficient budget',
                    cost: '0',
                    timestamp: new Date().toISOString(),
                };
            }

            // Execute the request with x402 payment handling
            const fetchWithPayment = wrapFetchWithPayment(
                globalThis.fetch,
                session.metadata?.walletClient,
                BigInt(remainingBudget)
            );

            const response = await fetchWithPayment(context.url, {
                method: context.method,
                headers: context.headers,
                body: context.body,
            });

            // Record spending
            await this.config.meteringService.recordSpending(sessionId, estimatedCost, {
                requestId: context.metadata?.requestId,
                endpoint: context.url,
                method: context.method,
                currency: 'USDC',
            });

            // Update session
            await this.config.sessionManager.updateSession(sessionId, {
                requestCount: session.requestCount + 1,
                totalSpent: (BigInt(session.totalSpent) + BigInt(estimatedCost)).toString(),
                remainingBudget: (BigInt(remainingBudget) - BigInt(estimatedCost)).toString(),
            });

            this.emitEvent({
                type: 'request_executed',
                sessionId,
                timestamp: new Date().toISOString(),
                data: {
                    url: context.url,
                    method: context.method,
                    cost: estimatedCost,
                    success: response.ok
                },
            });

            return {
                success: response.ok,
                response: response.ok ? await response.json() : null,
                error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
                cost: estimatedCost,
                policyResult,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cost: '0',
                timestamp: new Date().toISOString(),
            };
        }
    }

    async getRemainingBudget(sessionId: string): Promise<string> {
        return await this.config.meteringService.getRemainingBudget(sessionId);
    }

    async updateBudget(sessionId: string, amount: string): Promise<void> {
        await this.config.meteringService.updateBudget(sessionId, amount);
    }

    async evaluatePolicies(sessionId: string, context: RequestContext): Promise<PolicyEvaluationResult> {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const policyContext = {
            sessionId,
            agentId: session.agentId,
            delegatorId: session.delegatorId,
            requestUrl: context.url,
            requestMethod: context.method,
            requestHeaders: context.headers,
            requestBody: context.body,
            timestamp: new Date().toISOString(),
            metadata: context.metadata,
        };

        return await this.config.policyEngine.evaluatePolicies(policyContext);
    }

    async getMeteringData(sessionId: string): Promise<MeteringData> {
        return await this.config.meteringService.getMeteringData(sessionId);
    }

    onSessionEvent(callback: (event: RuntimeEvent) => void): void {
        this.eventListeners.add(callback);
    }

    offSessionEvent(callback: (event: RuntimeEvent) => void): void {
        this.eventListeners.delete(callback);
    }

    private emitEvent(event: RuntimeEvent): void {
        this.eventListeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in event listener:', error);
            }
        });
    }

    private async estimateRequestCost(context: RequestContext): Promise<string> {
        // Simple cost estimation based on endpoint and method
        // In a real implementation, this would be more sophisticated
        const baseCost = 1000; // 0.001 USDC
        const methodMultiplier = context.method === 'POST' ? 2 : 1;
        const endpointMultiplier = context.url.includes('/api/') ? 1.5 : 1;

        return Math.floor(baseCost * methodMultiplier * endpointMultiplier).toString();
    }
}

// Factory function to create a runtime instance
export function createVincentAgentRuntime(config: Partial<RuntimeConfig> = {}): VincentAgentRuntime {
    const defaultConfig: RuntimeConfig = {
        sessionManager: new InMemorySessionManager(new InMemorySessionStorage()),
        policyEngine: config.policyEngine!,
        meteringService: new InMemoryMeteringService(),
        signingService: config.signingService!,
        storage: new InMemorySessionStorage(),
        defaultMaxBudget: '1000000',
        defaultSessionTimeout: 3600, // 1 hour
        ...config,
    };

    return new VincentAgentRuntime(defaultConfig);
}

import {
    SettlementRequest,
    SettlementResponse,
    PolicyCreationRequest,
    PolicyUpdateRequest,
    PolicyQueryRequest,
    VerificationRequest,
    ApiResponse,
    PaginatedResponse
} from '../types/index.js';
import { logger } from '../core/logger.js';

export interface HederaFacilitatorClientConfig {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
    retries?: number;
}

export class HederaFacilitatorClient {
    private config: HederaFacilitatorClientConfig;
    private baseUrl: string;

    constructor(config: HederaFacilitatorClientConfig) {
        this.config = {
            timeout: 30000,
            retries: 3,
            ...config,
        };
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
    }

    /**
     * Make HTTP request with retries
     */
    private async makeRequest<T>(
        method: string,
        path: string,
        data?: any,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const requestOptions: RequestInit = {
            method,
            headers,
            ...options,
        };

        if (data && method !== 'GET') {
            requestOptions.body = JSON.stringify(data);
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.retries!; attempt++) {
            try {
                const response = await fetch(url, requestOptions);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                return result;
            } catch (error) {
                lastError = error as Error;

                if (attempt < this.config.retries!) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    logger.warn(`Request failed, retrying in ${delay}ms`, {
                        attempt: attempt + 1,
                        maxRetries: this.config.retries,
                        error: lastError.message,
                        url,
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('Request failed after all retries');
    }

    // Settlement methods
    async createSettlement(request: SettlementRequest): Promise<ApiResponse<SettlementResponse>> {
        return this.makeRequest<ApiResponse<SettlementResponse>>('POST', '/api/settlements', request);
    }

    async getSettlement(id: string): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('GET', `/api/settlements/${id}`);
    }

    async getSettlements(limit = 10, offset = 0, status?: string): Promise<PaginatedResponse> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
        });

        if (status) {
            params.append('status', status);
        }

        return this.makeRequest<PaginatedResponse>('GET', `/api/settlements?${params}`);
    }

    async verifySettlement(id: string): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('POST', `/api/settlements/${id}/verify`);
    }

    // Policy methods
    async createPolicy(request: PolicyCreationRequest): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('POST', '/api/policies', request);
    }

    async updatePolicy(id: string, request: Omit<PolicyUpdateRequest, 'policyId'>): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('PUT', `/api/policies/${id}`, request);
    }

    async getPolicy(id: string): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('GET', `/api/policies/${id}`);
    }

    async queryPolicies(request: PolicyQueryRequest): Promise<PaginatedResponse> {
        const params = new URLSearchParams();

        if (request.policyId) params.append('policyId', request.policyId);
        if (request.owner) params.append('owner', request.owner);
        if (request.status) params.append('status', request.status);
        params.append('limit', request.limit.toString());
        params.append('offset', request.offset.toString());

        return this.makeRequest<PaginatedResponse>('GET', `/api/policies?${params}`);
    }

    async archivePolicy(id: string, actor = 'system'): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('POST', `/api/policies/${id}/archive`, { actor });
    }

    async activatePolicy(id: string, actor = 'system'): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('POST', `/api/policies/${id}/activate`, { actor });
    }

    async deactivatePolicy(id: string, actor = 'system'): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('POST', `/api/policies/${id}/deactivate`, { actor });
    }

    async getPolicyAuditLog(id: string): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('GET', `/api/policies/${id}/audit`);
    }

    async getPolicyStatistics(): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('GET', '/api/policies/stats');
    }

    // Verification methods
    async verify(request: VerificationRequest): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('POST', '/api/verify', request);
    }

    async getVerification(id: string): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('GET', `/api/verifications/${id}`);
    }

    async getVerifications(limit = 10, offset = 0): Promise<PaginatedResponse> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
        });

        return this.makeRequest<PaginatedResponse>('GET', `/api/verifications?${params}`);
    }

    // Hedera methods
    async getHederaAccount(id: string): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('GET', `/api/hedera/account/${id}`);
    }

    async getHederaTransaction(id: string): Promise<ApiResponse<any>> {
        return this.makeRequest<ApiResponse<any>>('GET', `/api/hedera/transaction/${id}`);
    }

    // Health check
    async healthCheck(): Promise<any> {
        return this.makeRequest<any>('GET', '/health');
    }

    // Event stream connection
    connectEventStream(
        onMessage: (message: any) => void,
        onError?: (error: Error) => void,
        onClose?: () => void
    ): WebSocket {
        const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            logger.info('WebSocket connected to event stream');

            // Subscribe to all events
            ws.send(JSON.stringify({
                type: 'subscribe',
                topics: ['settlement', 'policy', 'verification', 'hedera'],
            }));
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                onMessage(message);
            } catch (error) {
                logger.error('Failed to parse WebSocket message', { error, data: event.data });
                onError?.(error as Error);
            }
        };

        ws.onerror = (error) => {
            logger.error('WebSocket error', { error });
            onError?.(error as any);
        };

        ws.onclose = () => {
            logger.info('WebSocket disconnected from event stream');
            onClose?.();
        };

        return ws;
    }
}

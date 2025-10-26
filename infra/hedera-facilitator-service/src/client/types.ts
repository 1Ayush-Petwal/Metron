export interface HederaFacilitatorClientConfig {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
    retries?: number;
}

export interface WebSocketMessage {
    type: 'event' | 'error' | 'heartbeat' | 'subscription_update';
    data: any;
    timestamp: string;
    subscriptionId?: string;
}

export interface EventSubscription {
    subscriptionId: string;
    topics: string[];
    filters?: Record<string, any>;
}

export interface ClientError extends Error {
    code?: string;
    statusCode?: number;
    details?: any;
}

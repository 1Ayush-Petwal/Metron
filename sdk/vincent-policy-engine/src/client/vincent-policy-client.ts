import { 
  PolicyDefinition,
  PolicyWithStats,
  DelegationDefinition,
  EnforcementResult,
  AuditEvent,
  AuditSummary,
  CreatePolicyRequest,
  UpdatePolicyRequest,
  CreateDelegationRequest,
  CheckSpendingRequest,
  ProcessPaymentRequest,
  PolicyQuery,
  DelegationQuery,
  AuditQuery,
  ApiResponse,
  GetPolicyResponse,
  ListPoliciesResponse,
  GetDelegationResponse,
  ListDelegationsResponse,
  CheckSpendingResponse,
  ProcessPaymentResponse,
  GetAuditEventsResponse,
  GetAuditSummaryResponse,
  HealthCheckResponse
} from '../types';

export interface VincentPolicyClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export class VincentPolicyClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private retries: number;

  constructor(config: VincentPolicyClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retries = config.retries || 3;
  }

  // Policy Management

  /**
   * Create a new policy
   */
  async createPolicy(request: CreatePolicyRequest, userId: string, agentId?: string): Promise<PolicyDefinition> {
    const response = await this.makeRequest<GetPolicyResponse>('POST', '/api/v1/policies', {
      body: request,
      headers: {
        'X-User-ID': userId,
        ...(agentId && { 'X-Agent-ID': agentId }),
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create policy');
    }

    return response.data;
  }

  /**
   * Get a policy by ID
   */
  async getPolicy(policyId: string): Promise<PolicyWithStats | null> {
    const response = await this.makeRequest<GetPolicyResponse>('GET', `/api/v1/policies/${policyId}`);

    if (!response.success) {
      if (response.error === 'Policy not found') {
        return null;
      }
      throw new Error(response.error || 'Failed to get policy');
    }

    return response.data || null;
  }

  /**
   * List policies
   */
  async listPolicies(query: PolicyQuery = {}): Promise<{
    policies: PolicyWithStats[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await this.makeRequest<ListPoliciesResponse>('GET', '/api/v1/policies', {
      query: query as Record<string, string>,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to list policies');
    }

    return response.data;
  }

  /**
   * Update a policy
   */
  async updatePolicy(policyId: string, request: UpdatePolicyRequest, userId: string, agentId?: string): Promise<PolicyDefinition> {
    const response = await this.makeRequest<GetPolicyResponse>('PUT', `/api/v1/policies/${policyId}`, {
      body: request,
      headers: {
        'X-User-ID': userId,
        ...(agentId && { 'X-Agent-ID': agentId }),
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update policy');
    }

    return response.data;
  }

  /**
   * Revoke a policy
   */
  async revokePolicy(policyId: string, userId: string, agentId?: string, reason?: string): Promise<PolicyDefinition> {
    const response = await this.makeRequest<GetPolicyResponse>('DELETE', `/api/v1/policies/${policyId}`, {
      query: reason ? { reason } : {},
      headers: {
        'X-User-ID': userId,
        ...(agentId && { 'X-Agent-ID': agentId }),
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to revoke policy');
    }

    return response.data;
  }

  /**
   * Evaluate a policy
   */
  async evaluatePolicy(policyId: string, context: any): Promise<any> {
    const response = await this.makeRequest<ApiResponse>('POST', `/api/v1/policies/${policyId}/evaluate`, {
      body: context,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to evaluate policy');
    }

    return response.data;
  }

  // Delegation Management

  /**
   * Create a delegation
   */
  async createDelegation(
    request: CreateDelegationRequest,
    delegatorWallet: string,
    delegateeWallet: string,
    userId: string,
    agentId?: string
  ): Promise<DelegationDefinition> {
    const response = await this.makeRequest<GetDelegationResponse>('POST', '/api/v1/delegations', {
      body: request,
      headers: {
        'X-User-ID': userId,
        'X-Delegator-Wallet': delegatorWallet,
        'X-Delegatee-Wallet': delegateeWallet,
        ...(agentId && { 'X-Agent-ID': agentId }),
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create delegation');
    }

    return response.data;
  }

  /**
   * Get a delegation by ID
   */
  async getDelegation(delegationId: string): Promise<DelegationDefinition | null> {
    const response = await this.makeRequest<GetDelegationResponse>('GET', `/api/v1/delegations/${delegationId}`);

    if (!response.success) {
      if (response.error === 'Delegation not found') {
        return null;
      }
      throw new Error(response.error || 'Failed to get delegation');
    }

    return response.data || null;
  }

  /**
   * List delegations
   */
  async listDelegations(query: DelegationQuery = {}): Promise<{
    delegations: DelegationDefinition[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await this.makeRequest<ListDelegationsResponse>('GET', '/api/v1/delegations', {
      query: query as Record<string, string>,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to list delegations');
    }

    return response.data;
  }

  /**
   * Revoke a delegation
   */
  async revokeDelegation(delegationId: string, userId: string, agentId?: string, reason?: string): Promise<DelegationDefinition> {
    const response = await this.makeRequest<GetDelegationResponse>('DELETE', `/api/v1/delegations/${delegationId}`, {
      query: reason ? { reason } : {},
      headers: {
        'X-User-ID': userId,
        ...(agentId && { 'X-Agent-ID': agentId }),
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to revoke delegation');
    }

    return response.data;
  }

  /**
   * Verify a delegation
   */
  async verifyDelegation(delegationId: string, delegatee: string, context: any = {}): Promise<any> {
    const response = await this.makeRequest<ApiResponse>('POST', `/api/v1/delegations/${delegationId}/verify`, {
      body: { delegatee, context },
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to verify delegation');
    }

    return response.data;
  }

  // Enforcement

  /**
   * Check spending limits
   */
  async checkSpending(request: CheckSpendingRequest): Promise<EnforcementResult> {
    const response = await this.makeRequest<CheckSpendingResponse>('POST', '/api/v1/enforcement/spending/check', {
      body: request,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to check spending');
    }

    return response.data;
  }

  /**
   * Process payment request
   */
  async processPayment(request: ProcessPaymentRequest): Promise<EnforcementResult> {
    const response = await this.makeRequest<ProcessPaymentResponse>('POST', '/api/v1/enforcement/payment/process', {
      body: request,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to process payment');
    }

    return response.data;
  }

  /**
   * Check rate limits
   */
  async checkRateLimit(endpoint: string): Promise<EnforcementResult> {
    const response = await this.makeRequest<ApiResponse>('POST', '/api/v1/enforcement/rate-limit/check', {
      body: { endpoint },
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to check rate limits');
    }

    return response.data;
  }

  /**
   * Check access control
   */
  async checkAccessControl(endpoint: string, method: string = 'GET'): Promise<EnforcementResult> {
    const response = await this.makeRequest<ApiResponse>('POST', '/api/v1/enforcement/access-control/check', {
      body: { endpoint, method },
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to check access control');
    }

    return response.data;
  }

  // Audit

  /**
   * Get audit events
   */
  async getAuditEvents(query: AuditQuery = {}): Promise<{
    events: AuditEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await this.makeRequest<GetAuditEventsResponse>('GET', '/api/v1/audit/events', {
      query: query as Record<string, string>,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get audit events');
    }

    return response.data;
  }

  /**
   * Get audit summary
   */
  async getAuditSummary(startTime: string, endTime: string): Promise<AuditSummary> {
    const response = await this.makeRequest<GetAuditSummaryResponse>('GET', '/api/v1/audit/summary', {
      query: { startTime, endTime },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get audit summary');
    }

    return response.data;
  }

  // Health

  /**
   * Get health status
   */
  async getHealth(): Promise<HealthCheckResponse['data']> {
    const response = await this.makeRequest<HealthCheckResponse>('GET', '/health');

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get health status');
    }

    return response.data;
  }

  // Private methods

  /**
   * Make HTTP request
   */
  private async makeRequest<T extends ApiResponse>(
    method: string,
    path: string,
    options: {
      body?: any;
      query?: Record<string, string>;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    
    // Add query parameters
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value);
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers,
      ...(options.body && { body: JSON.stringify(options.body) }),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url.toString(), {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.retries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }
}

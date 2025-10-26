// Note: In a real implementation, you would install and import uuid
// import { v4 as uuidv4 } from 'uuid';

// Mock UUID function for now
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import { 
  AuditEvent,
  AuditEventType,
  AuditEventSeverity,
  PolicyAuditEvent,
  DelegationAuditEvent,
  PaymentAuditEvent,
  PolicyEvaluationAuditEvent,
  ViolationAuditEvent,
  SystemErrorAuditEvent,
  AuditQuery,
  AuditSummary
} from '../types';
import { HederaRegistry } from './hedera-registry';

export interface AuditLoggerConfig {
  hederaRegistry: HederaRegistry;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableHederaLogging: boolean;
  enableConsoleLogging: boolean;
}

export class AuditLogger {
  private hederaRegistry: HederaRegistry;
  private logLevel: 'debug' | 'info' | 'warn' | 'error';
  private enableHederaLogging: boolean;
  private enableConsoleLogging: boolean;
  private events: AuditEvent[] = [];

  constructor(config: AuditLoggerConfig) {
    this.hederaRegistry = config.hederaRegistry;
    this.logLevel = config.logLevel;
    this.enableHederaLogging = config.enableHederaLogging;
    this.enableConsoleLogging = config.enableConsoleLogging;
  }

  /**
   * Log a policy created event
   */
  async logPolicyCreated(data: {
    policyId: string;
    policyName: string;
    userId: string;
    agentId?: string;
    changes: any;
  }): Promise<void> {
    const event: PolicyAuditEvent = {
      id: uuidv4(),
      type: 'policy_created',
      severity: 'info',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      policyId: data.policyId,
      policyName: data.policyName,
      changes: data.changes,
    };

    await this.logEvent(event);
  }

  /**
   * Log a policy updated event
   */
  async logPolicyUpdated(data: {
    policyId: string;
    policyName: string;
    userId: string;
    agentId?: string;
    changes: any;
  }): Promise<void> {
    const event: PolicyAuditEvent = {
      id: uuidv4(),
      type: 'policy_updated',
      severity: 'info',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      policyId: data.policyId,
      policyName: data.policyName,
      changes: data.changes,
    };

    await this.logEvent(event);
  }

  /**
   * Log a policy revoked event
   */
  async logPolicyRevoked(data: {
    policyId: string;
    policyName: string;
    userId: string;
    agentId?: string;
    reason?: string;
  }): Promise<void> {
    const event: PolicyAuditEvent = {
      id: uuidv4(),
      type: 'policy_revoked',
      severity: 'warn',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      policyId: data.policyId,
      policyName: data.policyName,
      reason: data.reason,
    };

    await this.logEvent(event);
  }

  /**
   * Log a delegation created event
   */
  async logDelegationCreated(data: {
    delegationId: string;
    delegator: string;
    delegatee: string;
    scope: any;
    userId: string;
    agentId?: string;
  }): Promise<void> {
    const event: DelegationAuditEvent = {
      id: uuidv4(),
      type: 'delegation_created',
      severity: 'info',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      delegationId: data.delegationId,
      delegator: data.delegator,
      delegatee: data.delegatee,
      scope: data.scope,
    };

    await this.logEvent(event);
  }

  /**
   * Log a delegation revoked event
   */
  async logDelegationRevoked(data: {
    delegationId: string;
    delegator: string;
    delegatee: string;
    scope: any;
    userId: string;
    agentId?: string;
    reason?: string;
  }): Promise<void> {
    const event: DelegationAuditEvent = {
      id: uuidv4(),
      type: 'delegation_revoked',
      severity: 'warn',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      delegationId: data.delegationId,
      delegator: data.delegator,
      delegatee: data.delegatee,
      scope: data.scope,
      reason: data.reason,
    };

    await this.logEvent(event);
  }

  /**
   * Log a payment processed event
   */
  async logPaymentProcessed(data: {
    userId: string;
    agentId?: string;
    amount: string;
    currency: string;
    network: string;
    endpoint: string;
    policyResults: any[];
  }): Promise<void> {
    const event: PaymentAuditEvent = {
      id: uuidv4(),
      type: 'payment_processed',
      severity: 'info',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      amount: data.amount,
      currency: data.currency,
      network: data.network,
      endpoint: data.endpoint,
      policyResults: data.policyResults,
    };

    await this.logEvent(event);
  }

  /**
   * Log a payment denied event
   */
  async logPaymentDenied(data: {
    userId: string;
    agentId?: string;
    amount: string;
    currency: string;
    network: string;
    endpoint: string;
    reason: string;
    policyResults: any[];
  }): Promise<void> {
    const event: PaymentAuditEvent = {
      id: uuidv4(),
      type: 'payment_denied',
      severity: 'warn',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      amount: data.amount,
      currency: data.currency,
      network: data.network,
      endpoint: data.endpoint,
      policyResults: data.policyResults,
      reason: data.reason,
    };

    await this.logEvent(event);
  }

  /**
   * Log a policy evaluation event
   */
  async logPolicyEvaluated(data: {
    policyId: string;
    policyName: string;
    userId: string;
    agentId?: string;
    allowed: boolean;
    reason?: string;
    remainingAmount?: string;
    violations?: any[];
  }): Promise<void> {
    const event: PolicyEvaluationAuditEvent = {
      id: uuidv4(),
      type: 'policy_evaluated',
      severity: 'info',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      policyId: data.policyId,
      policyName: data.policyName,
      allowed: data.allowed,
      reason: data.reason,
      remainingAmount: data.remainingAmount,
      violations: data.violations,
    };

    await this.logEvent(event);
  }

  /**
   * Log a violation detected event
   */
  async logViolationDetected(data: {
    policyId: string;
    policyName: string;
    violationType: string;
    violationMessage: string;
    action: string;
    context: any;
    userId: string;
    agentId?: string;
  }): Promise<void> {
    const event: ViolationAuditEvent = {
      id: uuidv4(),
      type: 'violation_detected',
      severity: 'high',
      timestamp: new Date().toISOString(),
      userId: data.userId,
      agentId: data.agentId,
      policyId: data.policyId,
      policyName: data.policyName,
      violationType: data.violationType,
      violationMessage: data.violationMessage,
      action: data.action,
      context: data.context,
    };

    await this.logEvent(event);
  }

  /**
   * Log a system error event
   */
  async logSystemError(data: {
    errorCode: string;
    errorMessage: string;
    component: string;
    context?: any;
    stackTrace?: string;
  }): Promise<void> {
    const event: SystemErrorAuditEvent = {
      id: uuidv4(),
      type: 'system_error',
      severity: 'critical',
      timestamp: new Date().toISOString(),
      userId: 'system',
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      stackTrace: data.stackTrace,
      component: data.component,
      context: data.context,
    };

    await this.logEvent(event);
  }

  /**
   * Log a generic event
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      // Store event locally
      this.events.push(event);

      // Log to console if enabled
      if (this.enableConsoleLogging) {
        this.logToConsole(event);
      }

      // Log to Hedera if enabled
      if (this.enableHederaLogging) {
        await this.hederaRegistry.logAuditEvent(event);
      }
    } catch (error) {
      // Don't throw errors from logging to avoid breaking the main flow
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery): Promise<{
    events: AuditEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      let filteredEvents = [...this.events];

      // Apply filters
      if (query.userId) {
        filteredEvents = filteredEvents.filter(e => e.userId === query.userId);
      }

      if (query.agentId) {
        filteredEvents = filteredEvents.filter(e => e.agentId === query.agentId);
      }

      if (query.type) {
        filteredEvents = filteredEvents.filter(e => e.type === query.type);
      }

      if (query.severity) {
        filteredEvents = filteredEvents.filter(e => e.severity === query.severity);
      }

      if (query.startTime) {
        const startTime = new Date(query.startTime);
        filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) >= startTime);
      }

      if (query.endTime) {
        const endTime = new Date(query.endTime);
        filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) <= endTime);
      }

      // Apply sorting
      if (query.sortBy) {
        filteredEvents.sort((a, b) => {
          const aValue = a[query.sortBy as keyof AuditEvent];
          const bValue = b[query.sortBy as keyof AuditEvent];
          
          if (aValue < bValue) return query.sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return query.sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // Apply pagination
      const total = filteredEvents.length;
      const startIndex = query.offset;
      const endIndex = startIndex + query.limit;
      const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

      return {
        events: paginatedEvents,
        total,
        page: Math.floor(query.offset / query.limit) + 1,
        limit: query.limit,
      };
    } catch (error) {
      throw new Error(`Failed to query audit events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get audit summary
   */
  async getAuditSummary(startTime: string, endTime: string): Promise<AuditSummary> {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      const eventsInRange = this.events.filter(e => {
        const eventTime = new Date(e.timestamp);
        return eventTime >= start && eventTime <= end;
      });

      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      let recentViolations = 0;
      let totalSpent = '0';
      let totalTransactions = 0;

      for (const event of eventsInRange) {
        // Count by type
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        
        // Count by severity
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
        
        // Count violations
        if (event.type === 'violation_detected') {
          recentViolations++;
        }
        
        // Sum spending
        if (event.type === 'payment_processed') {
          const paymentEvent = event as PaymentAuditEvent;
          totalSpent = (BigInt(totalSpent) + BigInt(paymentEvent.amount)).toString();
          totalTransactions++;
        }
      }

      return {
        totalEvents: eventsInRange.length,
        eventsByType,
        eventsBySeverity,
        recentViolations,
        totalSpent,
        totalTransactions,
        timeRange: {
          start: startTime,
          end: endTime,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get audit summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Log to console
   */
  private logToConsole(event: AuditEvent): void {
    const logLevel = this.getLogLevel(event.severity);
    const message = `[${event.timestamp}] ${event.type.toUpperCase()}: ${event.userId}${event.agentId ? ` (agent: ${event.agentId})` : ''}`;
    
    switch (logLevel) {
      case 'debug':
        console.debug(message, event);
        break;
      case 'info':
        console.info(message, event);
        break;
      case 'warn':
        console.warn(message, event);
        break;
      case 'error':
        console.error(message, event);
        break;
    }
  }

  /**
   * Get log level for severity
   */
  private getLogLevel(severity: AuditEventSeverity): 'debug' | 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'low':
        return 'debug';
      case 'medium':
        return 'info';
      case 'high':
        return 'warn';
      case 'critical':
        return 'error';
      default:
        return 'info';
    }
  }

  /**
   * Clear local events (for testing)
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.length;
  }
}

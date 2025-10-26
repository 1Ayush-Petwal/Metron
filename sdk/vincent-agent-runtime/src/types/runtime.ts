import { z } from 'zod';
import type { SessionState, SessionConfig } from './session';
import type { PolicyEvaluationResult } from './policy';
import type { MeteringData } from './metering';

// Runtime Configuration
export const RuntimeConfigSchema = z.object({
  sessionManager: z.any(), // SessionManager
  policyEngine: z.any(), // VincentPolicyEngine
  meteringService: z.any(), // MeteringService
  signingService: z.any(), // SigningService
  storage: z.any(), // SessionStorage
  defaultMaxBudget: z.string().optional(),
  defaultSessionTimeout: z.number().positive().optional(),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

// Request Context
export const RequestContextSchema = z.object({
  sessionId: z.string().uuid(),
  url: z.string().url(),
  method: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  metadata: z.record(z.any()).optional(),
});

export type RequestContext = z.infer<typeof RequestContextSchema>;

// Request Result
export const RequestResultSchema = z.object({
  success: z.boolean(),
  response: z.any().optional(),
  error: z.string().optional(),
  cost: z.string(),
  policyResult: z.any().optional(), // PolicyEvaluationResult
  meteringData: z.any().optional(), // MeteringData
  timestamp: z.string().datetime(),
});

export type RequestResult = z.infer<typeof RequestResultSchema>;

// Agent Runtime Interface
export interface AgentRuntime {
  // Session Management
  initSession(config: SessionConfig): Promise<SessionState>;
  endSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): Promise<SessionState | null>;
  listSessions(agentId?: string): Promise<SessionState[]>;
  
  // Request Execution
  executeRequest(sessionId: string, context: RequestContext): Promise<RequestResult>;
  
  // Budget Management
  getRemainingBudget(sessionId: string): Promise<string>;
  updateBudget(sessionId: string, amount: string): Promise<void>;
  
  // Policy Management
  evaluatePolicies(sessionId: string, context: RequestContext): Promise<PolicyEvaluationResult>;
  
  // Metering
  getMeteringData(sessionId: string): Promise<MeteringData>;
  
  // Events
  onSessionEvent(callback: (event: any) => void): void;
  offSessionEvent(callback: (event: any) => void): void;
}

// Runtime Events
export const RuntimeEventSchema = z.object({
  type: z.enum(['session_created', 'session_terminated', 'request_executed', 'budget_exceeded', 'policy_violation']),
  sessionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  data: z.record(z.any()).optional(),
});

export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;

// Runtime Error
export const RuntimeErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  sessionId: z.string().uuid().optional(),
  context: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
});

export type RuntimeError = z.infer<typeof RuntimeErrorSchema>;

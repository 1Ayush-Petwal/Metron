import { z } from 'zod';
import type { PolicyEvaluationResult as VincentPolicyEvaluationResult } from '@metron/vincent-policy-engine';

// Policy Evaluation Result
export const PolicyEvaluationResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  remainingAmount: z.string().optional(),
  resetTime: z.string().datetime().optional(),
  violations: z.array(z.object({
    type: z.string(),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })).optional(),
  metadata: z.record(z.any()).optional(),
});

export type PolicyEvaluationResult = z.infer<typeof PolicyEvaluationResultSchema>;

// Policy Context
export const PolicyContextSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  delegatorId: z.string(),
  requestUrl: z.string().url(),
  requestMethod: z.string(),
  requestHeaders: z.record(z.string()).optional(),
  requestBody: z.any().optional(),
  amount: z.string().optional(),
  currency: z.string().optional(),
  network: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

export type PolicyContext = z.infer<typeof PolicyContextSchema>;

// Policy Manager Interface
export interface PolicyManager {
  evaluatePolicies(context: PolicyContext): Promise<PolicyEvaluationResult>;
  getActivePolicies(agentId: string): Promise<any[]>;
  updatePolicy(policyId: string, policy: any): Promise<void>;
  removePolicy(policyId: string): Promise<void>;
}

// Policy Violation
export const PolicyViolationSchema = z.object({
  type: z.string(),
  message: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  policyId: z.string().optional(),
  context: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
});

export type PolicyViolation = z.infer<typeof PolicyViolationSchema>;

// Policy Enforcement Result
export const PolicyEnforcementResultSchema = z.object({
  allowed: z.boolean(),
  violations: z.array(PolicyViolationSchema),
  remainingBudget: z.string().optional(),
  resetTime: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export type PolicyEnforcementResult = z.infer<typeof PolicyEnforcementResultSchema>;

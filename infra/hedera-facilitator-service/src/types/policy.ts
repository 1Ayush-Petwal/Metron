import { z } from 'zod';

// Policy Registry Entry
export const PolicyRegistryEntrySchema = z.object({
  policyId: z.string().uuid(),
  policyHash: z.string(),
  owner: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(['active', 'inactive', 'archived']),
  transactionId: z.string(),
  consensusTimestamp: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type PolicyRegistryEntry = z.infer<typeof PolicyRegistryEntrySchema>;

// Policy Creation Request
export const PolicyCreationRequestSchema = z.object({
  policyHash: z.string(),
  owner: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type PolicyCreationRequest = z.infer<typeof PolicyCreationRequestSchema>;

// Policy Update Request
export const PolicyUpdateRequestSchema = z.object({
  policyId: z.string().uuid(),
  policyHash: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  metadata: z.record(z.any()).optional(),
});

export type PolicyUpdateRequest = z.infer<typeof PolicyUpdateRequestSchema>;

// Policy Response
export const PolicyResponseSchema = z.object({
  success: z.boolean(),
  policyId: z.string().uuid(),
  transactionId: z.string().optional(),
  consensusTimestamp: z.string().optional(),
  error: z.string().optional(),
});

export type PolicyResponse = z.infer<typeof PolicyResponseSchema>;

// Policy Query Request
export const PolicyQueryRequestSchema = z.object({
  policyId: z.string().uuid().optional(),
  owner: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
});

export type PolicyQueryRequest = z.infer<typeof PolicyQueryRequestSchema>;

// Policy Query Response
export const PolicyQueryResponseSchema = z.object({
  success: z.boolean(),
  policies: z.array(PolicyRegistryEntrySchema),
  total: z.number(),
  hasMore: z.boolean(),
  error: z.string().optional(),
});

export type PolicyQueryResponse = z.infer<typeof PolicyQueryResponseSchema>;

// Policy Event
export const PolicyEventSchema = z.object({
  eventType: z.enum(['policy_created', 'policy_updated', 'policy_archived', 'policy_activated', 'policy_deactivated']),
  policyId: z.string().uuid(),
  owner: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.any()),
});

export type PolicyEvent = z.infer<typeof PolicyEventSchema>;

// Policy Audit Entry
export const PolicyAuditEntrySchema = z.object({
  auditId: z.string().uuid(),
  policyId: z.string().uuid(),
  action: z.string(),
  actor: z.string(),
  timestamp: z.string().datetime(),
  transactionId: z.string(),
  consensusTimestamp: z.string(),
  details: z.record(z.any()).optional(),
});

export type PolicyAuditEntry = z.infer<typeof PolicyAuditEntrySchema>;

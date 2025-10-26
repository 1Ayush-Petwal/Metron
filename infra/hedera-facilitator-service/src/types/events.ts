import { z } from 'zod';

// Base Event Schema
export const BaseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  timestamp: z.string().datetime(),
  source: z.string(),
  version: z.string().default('1.0.0'),
  data: z.record(z.any()),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

// Event Stream Configuration
export const EventStreamConfigSchema = z.object({
  streamId: z.string(),
  topics: z.array(z.string()),
  filters: z.record(z.any()).optional(),
  batchSize: z.number().min(1).max(1000).default(100),
  pollInterval: z.number().min(1000).default(5000),
  maxRetries: z.number().min(0).default(3),
  retryDelay: z.number().min(1000).default(1000),
});

export type EventStreamConfig = z.infer<typeof EventStreamConfigSchema>;

// Event Subscription
export const EventSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  clientId: z.string(),
  topics: z.array(z.string()),
  filters: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  isActive: z.boolean(),
  lastEventId: z.string().optional(),
});

export type EventSubscription = z.infer<typeof EventSubscriptionSchema>;

// WebSocket Event
export const WebSocketEventSchema = z.object({
  type: z.enum(['event', 'error', 'heartbeat', 'subscription_update']),
  data: z.any(),
  timestamp: z.string().datetime(),
  subscriptionId: z.string().uuid().optional(),
});

export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;

// Event Handler
export const EventHandlerSchema = z.object({
  handlerId: z.string().uuid(),
  eventType: z.string(),
  handler: z.function(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export type EventHandler = z.infer<typeof EventHandlerSchema>;

// Event Processing Result
export const EventProcessingResultSchema = z.object({
  success: z.boolean(),
  processedCount: z.number(),
  failedCount: z.number(),
  errors: z.array(z.string()),
  timestamp: z.string().datetime(),
});

export type EventProcessingResult = z.infer<typeof EventProcessingResultSchema>;

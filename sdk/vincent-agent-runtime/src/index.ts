// Core exports
export * from './core/agent-runtime';
export * from './core/session-manager';
export * from './core/session-storage';
export * from './core/policy-manager';
export * from './core/metering-service';
export * from './core/signing-service';

// Type exports
export * from './types';

// Factory function
export { createVincentAgentRuntime } from './core/agent-runtime';

// Version
export const VERSION = '0.1.0';

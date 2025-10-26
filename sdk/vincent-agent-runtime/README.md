# Vincent Agent Runtime

The Vincent Agent Runtime is the execution layer for agents operating under Vincent policies. It manages session state, policy enforcement, spending metering, and cryptographic signing for x402-enabled API requests.

## Features

- **Session Management**: Initialize and manage agent sessions with delegated wallet access
- **Policy Integration**: Fetch and apply active policies from vincent-policy-engine
- **Spending Metering**: Track cumulative spending per session with budget enforcement
- **Signing & Verification**: Handle cryptographic signing of payment headers and policy proofs
- **Runtime API**: Comprehensive SDK interface for agent operations

## Installation

```bash
npm install @metron/vincent-agent-runtime
```

## Quick Start

```typescript
import { createVincentAgentRuntime } from '@metron/vincent-agent-runtime';
import { VincentSigningService } from '@metron/vincent-agent-runtime';
import type { VincentClientConfig } from '@metron/vincent-policy-engine';

// Create signing service
const signingService = new VincentSigningService({
  walletClient: yourWalletClient,
  vincentConfig: yourVincentConfig,
  signingMethod: 'vincent',
});

// Create runtime
const runtime = createVincentAgentRuntime({
  signingService,
  policyEngine: yourPolicyEngine,
});

// Initialize session
const session = await runtime.initSession({
  agentId: 'agent-123',
  delegatorId: 'delegator-456',
  walletClient: yourWalletClient,
  vincentConfig: yourVincentConfig,
  maxBudget: '1000000', // 1 USDC
  sessionTimeout: 3600, // 1 hour
});

// Execute request
const result = await runtime.executeRequest(session.sessionId, {
  sessionId: session.sessionId,
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
});

// Get remaining budget
const remainingBudget = await runtime.getRemainingBudget(session.sessionId);

// End session
await runtime.endSession(session.sessionId);
```

## Core Components

### Session Management

The runtime manages agent sessions with the following capabilities:

- **Session Creation**: Initialize sessions with delegated wallet access
- **Session State**: Track session status, budget, and activity
- **Session Lifecycle**: Handle session creation, updates, and termination
- **Session Storage**: Persistent storage for session data

### Policy Integration

Integrates with vincent-policy-engine for policy enforcement:

- **Policy Evaluation**: Evaluate policies before request execution
- **Policy Violations**: Handle and track policy violations
- **Policy Updates**: Support for dynamic policy updates
- **Policy Context**: Rich context for policy evaluation

### Spending Metering

Comprehensive spending tracking and budget management:

- **Budget Tracking**: Monitor remaining budget per session
- **Cost Calculation**: Estimate and track request costs
- **Spending History**: Maintain detailed spending records
- **Budget Enforcement**: Prevent overspending with automatic halts

### Signing & Verification

Cryptographic operations for secure payments:

- **Payment Headers**: Sign x402 payment headers
- **Policy Proofs**: Create and verify policy proofs
- **Signature Verification**: Verify signatures and delegations
- **Key Management**: Handle public/private key operations

## API Reference

### AgentRuntime Interface

```typescript
interface AgentRuntime {
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
  onSessionEvent(callback: (event: RuntimeEvent) => void): void;
  offSessionEvent(callback: (event: RuntimeEvent) => void): void;
}
```

### Session Configuration

```typescript
interface SessionConfig {
  agentId: string;
  delegatorId: string;
  walletClient: Signer | MultiNetworkSigner;
  vincentConfig: VincentClientConfig;
  maxBudget?: string;
  sessionTimeout?: number;
  metadata?: Record<string, any>;
}
```

### Request Context

```typescript
interface RequestContext {
  sessionId: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  metadata?: Record<string, any>;
}
```

## Event System

The runtime emits events for monitoring and debugging:

```typescript
runtime.onSessionEvent((event) => {
  switch (event.type) {
    case 'session_created':
      console.log('New session created:', event.data);
      break;
    case 'request_executed':
      console.log('Request executed:', event.data);
      break;
    case 'budget_exceeded':
      console.log('Budget exceeded:', event.data);
      break;
    case 'policy_violation':
      console.log('Policy violation:', event.data);
      break;
  }
});
```

## Error Handling

The runtime provides comprehensive error handling:

```typescript
try {
  const result = await runtime.executeRequest(sessionId, context);
  if (!result.success) {
    console.error('Request failed:', result.error);
  }
} catch (error) {
  console.error('Runtime error:', error);
}
```

## Integration with x402

The runtime seamlessly integrates with x402 for payment handling:

- **Automatic Payment Headers**: Creates and signs payment headers automatically
- **402 Response Handling**: Handles 402 Payment Required responses
- **Payment Verification**: Verifies payment requirements and amounts
- **Multi-Network Support**: Supports both EVM and SVM networks

## Compatibility

- **Vincent Policy Engine**: Full compatibility with vincent-policy-engine
- **x402 SDK**: Integrates with x402 and x402-fetch
- **Gemini CLI**: Compatible with gemini-cli for agent operations
- **TypeScript**: Full TypeScript support with comprehensive types

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

## License

Apache-2.0

## Contributing

Contributions are welcome! Please see our contributing guidelines for details.

## Support

For support and questions, please open an issue on GitHub.

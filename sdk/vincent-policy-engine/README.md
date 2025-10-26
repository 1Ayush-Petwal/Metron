# Vincent Policy Engine

A comprehensive policy management and enforcement system for x402-enabled APIs, built with Vincent SDK and Hedera blockchain integration.

## Features

- **Policy Management**: Create, update, and revoke spending policies with flexible configurations
- **Delegation System**: User-to-agent wallet delegation using Vincent SDK
- **Enforcement Engine**: Intercept x402 payment requests and enforce policy limits
- **Audit Logging**: Record all transactions and policy changes on Hedera
- **REST API**: Complete REST interface for policy and delegation management
- **TypeScript SDK**: Type-safe client library for easy integration

## Installation

```bash
npm install @metron/vincent-policy-engine
```

## Quick Start

### Server Setup

```typescript
import { createApiServer, defaultConfig } from '@metron/vincent-policy-engine';

const server = await createApiServer({
  ...defaultConfig,
  port: 3000,
  hederaConfig: {
    network: 'testnet',
    mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
    consensusNodeUrl: 'https://testnet.hedera.com',
    operatorId: process.env.HEDERA_OPERATOR_ID!,
    operatorKey: process.env.HEDERA_OPERATOR_KEY!,
  },
  vincentConfig: {
    network: 'testnet',
    rpcUrl: process.env.VINCENT_RPC_URL!,
    privateKey: process.env.VINCENT_PRIVATE_KEY!,
  },
});

console.log('Policy engine server running on port 3000');
```

### Client Usage

```typescript
import { VincentPolicyClient } from '@metron/vincent-policy-engine';

const client = new VincentPolicyClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key', // optional
});

// Create a spending policy
const policy = await client.createPolicy({
  name: 'Daily Spending Limit',
  type: 'spending_limit',
  config: {
    type: 'spending_limit',
    config: {
      maxAmount: '5000000', // $5 USDC (6 decimals)
      currency: 'USDC',
      network: 'base-sepolia',
      timeWindow: { type: 'daily' },
    },
  },
}, 'user123');

// Create a delegation
const delegation = await client.createDelegation({
  delegatee: 'agent456',
  scope: {
    policies: [policy.id],
    maxAmount: '1000000', // $1 USDC
    timeLimit: 3600, // 1 hour
  },
}, 'user-wallet-address', 'agent-wallet-address', 'user123');

// Check spending before payment
const result = await client.checkSpending({
  userId: 'user123',
  agentId: 'agent456',
  amount: '100000', // $0.10 USDC
  currency: 'USDC',
  network: 'base-sepolia',
  endpoint: '/api/inference',
});

if (result.allowed) {
  // Process payment
  console.log('Payment allowed:', result.reason);
} else {
  console.log('Payment denied:', result.reason);
}
```

## Policy Types

### Spending Limit Policy

Control how much can be spent on API calls within a time window.

```typescript
const spendingPolicy = {
  name: 'API Spending Limit',
  type: 'spending_limit',
  config: {
    type: 'spending_limit',
    config: {
      maxAmount: '10000000', // $10 USDC
      currency: 'USDC',
      network: 'base-sepolia',
      timeWindow: { type: 'daily' },
      perTransactionLimit: '1000000', // $1 per transaction
      allowedEndpoints: ['/api/inference', '/api/chat'],
    },
  },
};
```

### Rate Limit Policy

Control the frequency of API requests.

```typescript
const rateLimitPolicy = {
  name: 'API Rate Limit',
  type: 'rate_limit',
  config: {
    type: 'rate_limit',
    config: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      burstLimit: 10,
    },
  },
};
```

### Access Control Policy

Control who can access which endpoints.

```typescript
const accessPolicy = {
  name: 'API Access Control',
  type: 'access_control',
  config: {
    type: 'access_control',
    config: {
      allowedOrigins: ['https://myapp.com'],
      allowedUserAgents: ['MyApp/1.0'],
      requireAuthentication: true,
      allowedIPRanges: ['192.168.1.0/24'],
    },
  },
};
```

### Time-based Policy

Control when policies are active.

```typescript
const timePolicy = {
  name: 'Business Hours Only',
  type: 'time_based',
  config: {
    type: 'time_based',
    config: {
      startTime: '2024-01-01T09:00:00Z',
      endTime: '2024-12-31T17:00:00Z',
      timezone: 'UTC',
      allowedDays: [1, 2, 3, 4, 5], // Monday to Friday
      allowedHours: { start: 9, end: 17 },
    },
  },
};
```

## Delegation System

The delegation system allows users to grant agents permission to spend on their behalf within specified limits.

```typescript
// Create a delegation
const delegation = await client.createDelegation({
  delegatee: 'agent-wallet-address',
  scope: {
    policies: ['policy-id-1', 'policy-id-2'],
    maxAmount: '5000000', // $5 USDC
    timeLimit: 3600, // 1 hour
    allowedActions: ['inference', 'chat'],
    allowedNetworks: ['base-sepolia'],
  },
  expiresAt: '2024-12-31T23:59:59Z',
}, 'user-wallet-address', 'agent-wallet-address', 'user123');

// Verify delegation
const verification = await client.verifyDelegation(
  delegation.id,
  'agent-wallet-address',
  { amount: '100000', currency: 'USDC' }
);

if (verification.valid) {
  console.log('Delegation is valid');
} else {
  console.log('Delegation invalid:', verification.reason);
}
```

## Enforcement Integration

The enforcement engine integrates with x402 payment requests to automatically check policies before processing payments.

```typescript
// In your x402 middleware
import { EnforcementEngine } from '@metron/vincent-policy-engine';

const enforcementEngine = new EnforcementEngine({
  policyManager,
  delegationManager,
  auditLogger,
  config: {
    enabled: true,
    strictMode: false,
    requireDelegation: true,
  },
});

// Check payment before processing
const result = await enforcementEngine.processPaymentRequest({
  requestId: 'req-123',
  userId: 'user123',
  agentId: 'agent456',
  endpoint: '/api/inference',
  method: 'POST',
  headers: request.headers,
  body: request.body,
  timestamp: new Date().toISOString(),
  network: 'base-sepolia',
  amount: '100000',
  currency: 'USDC',
});

if (result.allowed) {
  // Process payment
  await processX402Payment(paymentData);
} else {
  // Deny payment
  throw new Error(`Payment denied: ${result.reason}`);
}
```

## API Reference

### REST Endpoints

#### Policies
- `POST /api/v1/policies` - Create policy
- `GET /api/v1/policies/:id` - Get policy
- `GET /api/v1/policies` - List policies
- `PUT /api/v1/policies/:id` - Update policy
- `DELETE /api/v1/policies/:id` - Revoke policy
- `POST /api/v1/policies/:id/evaluate` - Evaluate policy

#### Delegations
- `POST /api/v1/delegations` - Create delegation
- `GET /api/v1/delegations/:id` - Get delegation
- `GET /api/v1/delegations` - List delegations
- `DELETE /api/v1/delegations/:id` - Revoke delegation
- `POST /api/v1/delegations/:id/verify` - Verify delegation

#### Enforcement
- `POST /api/v1/enforcement/spending/check` - Check spending
- `POST /api/v1/enforcement/payment/process` - Process payment
- `POST /api/v1/enforcement/rate-limit/check` - Check rate limits
- `POST /api/v1/enforcement/access-control/check` - Check access control

#### Audit
- `GET /api/v1/audit/events` - Get audit events
- `GET /api/v1/audit/summary` - Get audit summary

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

## Configuration

### Environment Variables

```bash
# Hedera Configuration
HEDERA_OPERATOR_ID=0.0.123456
HEDERA_OPERATOR_KEY=302e020100300506032b657004220420...

# Vincent Configuration
VINCENT_RPC_URL=https://testnet.vincent.com
VINCENT_PRIVATE_KEY=0x...
VINCENT_PUBLIC_KEY=0x...
VINCENT_DID=did:hedera:testnet:...

# Server Configuration
PORT=3000
API_KEY=your-secret-api-key
LOG_LEVEL=info
```

### Server Configuration

```typescript
const config = {
  port: 3000,
  hederaConfig: {
    network: 'testnet',
    mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
    consensusNodeUrl: 'https://testnet.hedera.com',
    operatorId: process.env.HEDERA_OPERATOR_ID!,
    operatorKey: process.env.HEDERA_OPERATOR_KEY!,
  },
  vincentConfig: {
    network: 'testnet',
    rpcUrl: process.env.VINCENT_RPC_URL!,
    privateKey: process.env.VINCENT_PRIVATE_KEY!,
  },
  enforcementConfig: {
    enabled: true,
    strictMode: false,
    logLevel: 'info',
    cachePolicyResults: true,
    cacheTTL: 300,
    requireDelegation: true,
    challengeTimeout: 300,
  },
  enableAuth: true,
  enableCors: true,
  enableHelmet: true,
  logLevel: 'info',
};
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
npm run test:watch
```

### Linting

```bash
npm run lint
npm run lint:check
```

### Formatting

```bash
npm run format
npm run format:check
```

## License

Apache-2.0

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Support

For support and questions, please open an issue on GitHub or contact us at support@metron.ai.

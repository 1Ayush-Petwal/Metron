# Hedera Facilitator Service

A comprehensive service for handling on-chain settlement, verification, and policy registry interactions on the Hedera network for x402 and Vincent modules in the Autonome project.

## Overview

The Hedera Facilitator Service provides a bridge between the Autonome ecosystem and the Hedera network, enabling:

- **Transaction Settlement**: Record and verify x402 payment settlements on Hedera
- **Policy Registry**: Maintain Vincent policy state via Hedera Smart Contracts
- **Verification API**: Validate payment proofs, policy compliance, and transaction authenticity
- **Event Stream**: Real-time event streaming for policy and payment events
- **Multi-Protocol Support**: REST API and gRPC interfaces for seamless integration

## Features

### Core Capabilities

- 🔗 **Hedera Integration**: Full Hedera SDK integration with support for testnet, previewnet, and mainnet
- 💰 **Payment Settlement**: Complete x402 payment settlement workflow with on-chain verification
- 📋 **Policy Management**: Vincent policy registry with create, update, audit, and compliance features
- ✅ **Verification Services**: Multi-type verification for payments, policies, and transactions
- 📡 **Real-time Events**: WebSocket-based event streaming for live updates
- 🔌 **Dual APIs**: Both REST and gRPC interfaces for maximum compatibility
- 🛡️ **Security**: JWT authentication, API key support, and comprehensive audit logging
- 📊 **Monitoring**: Health checks, metrics, and comprehensive logging

### Technical Stack

- **Runtime**: Node.js with TypeScript
- **Blockchain**: Hedera Hashgraph SDK
- **APIs**: Express.js (REST) + gRPC
- **Real-time**: WebSocket (ws)
- **Validation**: Zod schemas
- **Logging**: Pino with structured logging
- **Build**: tsup for fast builds

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Hedera account with testnet access
- Basic understanding of Hedera and x402 protocols

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd infra/hedera-facilitator-service

# Install dependencies
npm install

# Copy environment configuration
cp env.example .env

# Edit configuration
nano .env
```

### Configuration

Edit the `.env` file with your Hedera credentials:

```env
# Hedera Network Configuration
HEDERA_NETWORK=testnet
HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com
HEDERA_CONSENSUS_NODE_URL=https://testnet.hedera.com:50211
HEDERA_OPERATOR_ID=0.0.123456
HEDERA_OPERATOR_KEY=302e020100300506032b657004220420...

# Service Configuration
PORT=3000
GRPC_PORT=50051
WS_PORT=8080
NODE_ENV=development

# Policy Registry Configuration
POLICY_REGISTRY_CONTRACT_ID=0.0.789012
POLICY_TOPIC_ID=0.0.345678

# Payment Settlement Configuration
PAYMENT_SETTLEMENT_CONTRACT_ID=0.0.456789
PAYMENT_TOPIC_ID=0.0.567890

# Security Configuration
JWT_SECRET=your-jwt-secret-key-here
API_KEY_SECRET=your-api-key-secret-here
```

### Running the Service

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start

# With Docker
docker build -t hedera-facilitator-service .
docker run -p 3000:3000 -p 50051:50051 -p 8080:8080 hedera-facilitator-service
```

## API Documentation

### REST API

The service exposes a comprehensive REST API at `http://localhost:3000`.

#### Settlement Endpoints

```http
POST   /api/settlements              # Create settlement
GET    /api/settlements/:id          # Get settlement
GET    /api/settlements              # List settlements
POST   /api/settlements/:id/verify   # Verify settlement
```

#### Policy Endpoints

```http
POST   /api/policies                 # Create policy
PUT    /api/policies/:id             # Update policy
GET    /api/policies/:id             # Get policy
GET    /api/policies                 # Query policies
POST   /api/policies/:id/archive     # Archive policy
POST   /api/policies/:id/activate    # Activate policy
POST   /api/policies/:id/deactivate  # Deactivate policy
GET    /api/policies/:id/audit       # Get audit log
GET    /api/policies/stats           # Get statistics
```

#### Verification Endpoints

```http
POST   /api/verify                   # Verify request
GET    /api/verifications/:id        # Get verification
GET    /api/verifications            # List verifications
```

#### System Endpoints

```http
GET    /health                       # Health check
GET    /api/version                  # API version
GET    /api/events/stats             # Event stream stats
GET    /api/hedera/account/:id       # Hedera account info
GET    /api/hedera/transaction/:id   # Hedera transaction
```

### gRPC API

The service also exposes a gRPC API on port 50051. See `src/proto/hedera_facilitator.proto` for the complete service definition.

### WebSocket Events

Connect to `ws://localhost:8080` for real-time events:

```javascript
const ws = new WebSocket('ws://localhost:8080');

// Subscribe to events
ws.send(JSON.stringify({
  type: 'subscribe',
  topics: ['settlement', 'policy', 'verification', 'hedera']
}));

// Handle messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Event:', message);
};
```

## Usage Examples

### Creating a Settlement

```typescript
import { HederaFacilitatorClient } from '@metron/hedera-facilitator-service/client';

const client = new HederaFacilitatorClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Create a settlement
const settlement = await client.createSettlement({
  paymentId: 'payment-123',
  amount: '100.50',
  currency: 'USD',
  payer: '0.0.123456',
  payee: '0.0.789012',
  metadata: {
    description: 'API access payment'
  }
});

console.log('Settlement created:', settlement.data);
```

### Managing Policies

```typescript
// Create a policy
const policy = await client.createPolicy({
  policyHash: '0x1234567890abcdef...',
  owner: '0.0.123456',
  metadata: {
    name: 'API Access Policy',
    description: 'Policy for API access limits'
  }
});

// Query policies
const policies = await client.queryPolicies({
  owner: '0.0.123456',
  status: 'active',
  limit: 10,
  offset: 0
});

console.log('Policies:', policies.data);
```

### Verification

```typescript
// Verify payment proof
const verification = await client.verify({
  type: 'payment_proof',
  data: {
    paymentId: 'payment-123',
    proof: 'proof-data',
    amount: '100.50',
    currency: 'USD',
    payer: '0.0.123456',
    payee: '0.0.789012',
    signature: 'signature-data'
  }
});

console.log('Verification result:', verification.data);
```

### Event Streaming

```typescript
// Connect to event stream
const ws = client.connectEventStream(
  (message) => {
    console.log('Received event:', message);
    
    if (message.type === 'event') {
      switch (message.data.eventType) {
        case 'settlement_created':
          console.log('New settlement:', message.data);
          break;
        case 'policy_updated':
          console.log('Policy updated:', message.data);
          break;
      }
    }
  },
  (error) => {
    console.error('WebSocket error:', error);
  },
  () => {
    console.log('WebSocket disconnected');
  }
);
```

## Architecture

### Service Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Hedera Facilitator Service               │
├─────────────────────────────────────────────────────────────┤
│  REST API Server    │  gRPC Server    │  WebSocket Server  │
├─────────────────────────────────────────────────────────────┤
│  Settlement Service │  Policy Service │  Verification Svc  │
├─────────────────────────────────────────────────────────────┤
│              Event Stream Service                          │
├─────────────────────────────────────────────────────────────┤
│                    Hedera Client                           │
├─────────────────────────────────────────────────────────────┤
│                    Hedera Network                          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Payment Settlement**:
   - Client creates settlement via API
   - Service records settlement locally
   - Settlement submitted to Hedera topic
   - Event stream notifies subscribers

2. **Policy Management**:
   - Policy created/updated via API
   - Changes recorded in Hedera topic
   - Audit log maintained
   - Real-time events broadcast

3. **Verification**:
   - Verification request received
   - Service queries Hedera for transaction data
   - Validation performed against settlement/policy data
   - Result returned with verification details

## Development

### Project Structure

```
src/
├── client/                 # Client SDK
│   ├── hedera-facilitator-client.ts
│   ├── types.ts
│   └── index.ts
├── core/                   # Core services
│   ├── hedera-client.ts
│   ├── config.ts
│   └── logger.ts
├── services/               # Business logic
│   ├── settlement-service.ts
│   ├── policy-registry-service.ts
│   ├── verification-service.ts
│   └── event-stream-service.ts
├── server/                 # API servers
│   ├── rest-api.ts
│   ├── grpc-server.ts
│   └── index.ts
├── types/                  # Type definitions
│   ├── hedera.ts
│   ├── settlement.ts
│   ├── policy.ts
│   ├── verification.ts
│   ├── events.ts
│   ├── api.ts
│   ├── config.ts
│   └── index.ts
├── proto/                  # gRPC definitions
│   └── hedera_facilitator.proto
└── index.ts               # Main entry point
```

### Building

```bash
# Build the project
npm run build

# Build with watch mode
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- settlement-service.test.ts
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HEDERA_NETWORK` | Hedera network (testnet/previewnet/mainnet) | testnet | Yes |
| `HEDERA_OPERATOR_ID` | Hedera operator account ID | - | Yes |
| `HEDERA_OPERATOR_KEY` | Hedera operator private key | - | Yes |
| `PORT` | REST API port | 3000 | No |
| `GRPC_PORT` | gRPC server port | 50051 | No |
| `WS_PORT` | WebSocket server port | 8080 | No |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `API_KEY_SECRET` | API key secret | - | Yes |

### Hedera Setup

1. Create a Hedera account on testnet
2. Obtain your account ID and private key
3. Create topics for policy and payment events
4. Deploy smart contracts for policy registry
5. Update configuration with your credentials

## Monitoring and Observability

### Health Checks

```bash
# Check service health
curl http://localhost:3000/health

# Response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "hedera": { "status": "healthy", "lastCheck": "..." },
    "eventStream": { "status": "healthy", "lastCheck": "..." }
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

### Logging

The service uses structured JSON logging with Pino:

```json
{
  "level": "info",
  "time": "2024-01-01T00:00:00.000Z",
  "msg": "Settlement created and submitted to Hedera",
  "settlementId": "uuid",
  "paymentId": "payment-123",
  "transactionId": "0.0.123456@1234567890.123456789"
}
```

### Metrics

- Request/response times
- Settlement success rates
- Policy operation counts
- Verification success rates
- WebSocket connection counts
- Hedera transaction metrics

## Security

### Authentication

- JWT tokens for user authentication
- API keys for service-to-service communication
- CORS configuration for web clients

### Data Protection

- All sensitive data encrypted at rest
- Secure transmission over HTTPS/WSS
- Private keys never logged or exposed
- Input validation and sanitization

### Audit Trail

- Complete audit log for all policy operations
- Transaction tracking for settlements
- Verification request logging
- Security event monitoring

## Troubleshooting

### Common Issues

1. **Hedera Connection Failed**
   - Check network configuration
   - Verify operator credentials
   - Ensure sufficient HBAR balance

2. **WebSocket Connection Issues**
   - Check firewall settings
   - Verify port configuration
   - Review client connection code

3. **Settlement Verification Failed**
   - Verify transaction exists on Hedera
   - Check settlement status
   - Review verification parameters

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Enable Hedera debug mode
HEDERA_DEBUG=true npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style

- Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting
- Write comprehensive tests
- Document public APIs

## License

Apache 2.0 - see LICENSE file for details.

## Support

- Documentation: [Link to docs]
- Issues: [GitHub Issues]
- Discussions: [GitHub Discussions]
- Email: support@metron.dev

## Changelog

### v1.0.0 (2024-01-01)

- Initial release
- Hedera integration
- Settlement service
- Policy registry
- Verification API
- Event streaming
- REST and gRPC APIs
- Client SDK

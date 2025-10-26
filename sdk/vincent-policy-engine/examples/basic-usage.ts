import { VincentPolicyClient, createSpendingLimitPolicy } from '@metron/vincent-policy-engine';

async function basicUsageExample() {
  // Initialize the client
  const client = new VincentPolicyClient({
    baseUrl: 'http://localhost:3000',
    apiKey: 'your-api-key', // optional
  });

  try {
    // 1. Create a spending limit policy
    console.log('Creating spending limit policy...');
    const policy = await client.createPolicy({
      name: 'Daily API Spending Limit',
      description: 'Limit daily spending on API calls to $5',
      type: 'spending_limit',
      config: {
        type: 'spending_limit',
        config: {
          maxAmount: '5000000', // $5 USDC (6 decimals)
          currency: 'USDC',
          network: 'base-sepolia',
          timeWindow: { type: 'daily' },
          perTransactionLimit: '1000000', // $1 per transaction
          allowedEndpoints: ['/api/inference', '/api/chat'],
        },
      },
    }, 'user123');

    console.log('Policy created:', policy.id);

    // 2. Create a delegation for an agent
    console.log('Creating delegation...');
    const delegation = await client.createDelegation({
      delegatee: 'agent456',
      scope: {
        policies: [policy.id],
        maxAmount: '2000000', // $2 USDC
        timeLimit: 3600, // 1 hour
        allowedActions: ['inference', 'chat'],
        allowedNetworks: ['base-sepolia'],
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    }, 'user-wallet-address', 'agent-wallet-address', 'user123');

    console.log('Delegation created:', delegation.id);

    // 3. Check spending before making a payment
    console.log('Checking spending limits...');
    const spendingCheck = await client.checkSpending({
      userId: 'user123',
      agentId: 'agent456',
      amount: '100000', // $0.10 USDC
      currency: 'USDC',
      network: 'base-sepolia',
      endpoint: '/api/inference',
    });

    if (spendingCheck.allowed) {
      console.log('✅ Payment allowed:', spendingCheck.reason);
      console.log('Remaining amount:', spendingCheck.totalRemainingAmount);
    } else {
      console.log('❌ Payment denied:', spendingCheck.reason);
    }

    // 4. Process a payment request
    console.log('Processing payment request...');
    const paymentResult = await client.processPayment({
      userId: 'user123',
      agentId: 'agent456',
      amount: '100000', // $0.10 USDC
      currency: 'USDC',
      network: 'base-sepolia',
      endpoint: '/api/inference',
      transactionHash: '0x1234567890abcdef',
    });

    if (paymentResult.allowed) {
      console.log('✅ Payment processed successfully');
    } else {
      console.log('❌ Payment processing failed:', paymentResult.reason);
    }

    // 5. Get policy details
    console.log('Getting policy details...');
    const policyDetails = await client.getPolicy(policy.id);
    if (policyDetails) {
      console.log('Policy usage:', policyDetails.usage);
    }

    // 6. List all policies
    console.log('Listing policies...');
    const policies = await client.listPolicies({
      userId: 'user123',
      page: 1,
      limit: 10,
    });
    console.log(`Found ${policies.total} policies`);

    // 7. Get audit events
    console.log('Getting audit events...');
    const auditEvents = await client.getAuditEvents({
      userId: 'user123',
      limit: 10,
    });
    console.log(`Found ${auditEvents.total} audit events`);

    // 8. Get health status
    console.log('Checking health status...');
    const health = await client.getHealth();
    console.log('Service status:', health.status);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };

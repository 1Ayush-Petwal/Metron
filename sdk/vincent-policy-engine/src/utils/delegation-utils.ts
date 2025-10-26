import { DelegationDefinition } from '../types';

/**
 * Create a delegation proof
 */
export function createDelegationProof(delegation: DelegationDefinition): string {
  const proofData = {
    delegationId: delegation.id,
    delegator: delegation.delegator,
    delegatee: delegation.delegatee,
    scope: delegation.scope,
    signature: delegation.signature,
    nonce: delegation.nonce,
    timestamp: delegation.createdAt,
  };

  return Buffer.from(JSON.stringify(proofData)).toString('base64');
}

/**
 * Verify a delegation proof
 */
export function verifyDelegationProof(proof: string): DelegationDefinition | null {
  try {
    const proofData = JSON.parse(Buffer.from(proof, 'base64').toString());

    // Basic validation
    if (!proofData.delegationId || !proofData.delegator || !proofData.delegatee) {
      return null;
    }

    // Create delegation definition from proof
    const delegation: DelegationDefinition = {
      id: proofData.delegationId,
      delegator: proofData.delegator,
      delegatee: proofData.delegatee,
      scope: proofData.scope,
      status: 'active',
      createdAt: proofData.timestamp,
      updatedAt: proofData.timestamp,
      signature: proofData.signature,
      nonce: proofData.nonce,
    };

    return delegation;
  } catch (error) {
    return null;
  }
}

/**
 * Check if delegation is expired
 */
export function isDelegationExpired(delegation: DelegationDefinition): boolean {
  if (!delegation.expiresAt) {
    return false;
  }

  return new Date(delegation.expiresAt) < new Date();
}

/**
 * Check if delegation is valid
 */
export function isDelegationValid(delegation: DelegationDefinition): boolean {
  // Check if delegation is active
  if (delegation.status !== 'active') {
    return false;
  }

  // Check if delegation is not expired
  if (isDelegationExpired(delegation)) {
    return false;
  }

  // Check if signature exists
  if (!delegation.signature || delegation.signature.length === 0) {
    return false;
  }

  // Check if nonce exists
  if (!delegation.nonce || delegation.nonce.length === 0) {
    return false;
  }

  return true;
}

/**
 * Get delegation scope summary
 */
export function getDelegationScopeSummary(delegation: DelegationDefinition): string {
  const parts: string[] = [];

  if (delegation.scope.policies && delegation.scope.policies.length > 0) {
    parts.push(`${delegation.scope.policies.length} policies`);
  }

  if (delegation.scope.maxAmount) {
    parts.push(`max ${delegation.scope.maxAmount} amount`);
  }

  if (delegation.scope.timeLimit) {
    parts.push(`${delegation.scope.timeLimit}s time limit`);
  }

  if (delegation.scope.allowedActions && delegation.scope.allowedActions.length > 0) {
    parts.push(`${delegation.scope.allowedActions.length} actions`);
  }

  if (delegation.scope.allowedNetworks && delegation.scope.allowedNetworks.length > 0) {
    parts.push(`${delegation.scope.allowedNetworks.length} networks`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no restrictions';
}

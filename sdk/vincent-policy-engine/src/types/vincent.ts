import { z } from 'zod';

// Vincent Policy Context
export const VincentPolicyContextSchema = z.object({
    delegation: z.object({
        delegator: z.string(),
        delegatee: z.string(),
        scope: z.record(z.any()),
        expiresAt: z.string().datetime().optional(),
    }),
    abilityParams: z.record(z.any()),
    userParams: z.record(z.any()),
    metadata: z.record(z.any()).optional(),
});

export type VincentPolicyContext = z.infer<typeof VincentPolicyContextSchema>;

// Vincent Policy Result
export const VincentPolicyResultSchema = z.object({
    allow: z.boolean(),
    result: z.any(),
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type VincentPolicyResult = z.infer<typeof VincentPolicyResultSchema>;

// Vincent Ability Context
export const VincentAbilityContextSchema = z.object({
    succeed: z.function().args(z.any()).returns(z.any()),
    fail: z.function().args(z.any()).returns(z.any()),
    policiesContext: z.object({
        allowedPolicies: z.record(z.any()),
    }),
    delegation: z.object({
        delegator: z.string(),
        delegatee: z.string(),
        scope: z.record(z.any()),
    }),
    metadata: z.record(z.any()).optional(),
});

export type VincentAbilityContext = z.infer<typeof VincentAbilityContextSchema>;

// Vincent Policy Schema
export const VincentPolicySchemaSchema = z.object({
    abilityParamsSchema: z.any(),
    userParamsSchema: z.any(),
    evalAllowResultSchema: z.any(),
    evalDenyResultSchema: z.any(),
    commitParamsSchema: z.any().optional(),
    commitAllowResultSchema: z.any().optional(),
    commitDenyResultSchema: z.any().optional(),
});

export type VincentPolicySchema = z.infer<typeof VincentPolicySchemaSchema>;

// Vincent Policy Definition
export const VincentPolicyDefinitionSchema = z.object({
    ipfsCid: z.string(),
    packageName: z.string(),
    schema: VincentPolicySchemaSchema,
    evaluate: z.function().args(z.any(), z.any()).returns(z.any()),
    commit: z.function().args(z.any(), z.any()).returns(z.any()).optional(),
});

export type VincentPolicyDefinition = z.infer<typeof VincentPolicyDefinitionSchema>;

// Vincent Ability Schema
export const VincentAbilitySchemaSchema = z.object({
    abilityParamsSchema: z.any(),
    executeSuccessSchema: z.any(),
    executeFailSchema: z.any(),
});

export type VincentAbilitySchema = z.infer<typeof VincentAbilitySchemaSchema>;

// Vincent Ability Policy
export const VincentAbilityPolicySchema = z.object({
    abilityParamsSchema: z.any(),
    PolicyConfig: VincentPolicyDefinitionSchema,
    abilityParameterMappings: z.record(z.string()),
});

export type VincentAbilityPolicy = z.infer<typeof VincentAbilityPolicySchema>;

// Vincent Ability Definition
export const VincentAbilityDefinitionSchema = z.object({
    packageName: z.string(),
    abilityDescription: z.string(),
    abilityParamsSchema: z.any(),
    supportedPolicies: z.array(VincentAbilityPolicySchema),
    executeSuccessSchema: z.any(),
    executeFailSchema: z.any(),
    execute: z.function().args(z.any(), z.any()).returns(z.any()),
});

export type VincentAbilityDefinition = z.infer<typeof VincentAbilityDefinitionSchema>;

// Vincent Client Configuration
export const VincentClientConfigSchema = z.object({
    network: z.string(),
    rpcUrl: z.string().url(),
    privateKey: z.string(),
    publicKey: z.string().optional(),
    did: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type VincentClientConfig = z.infer<typeof VincentClientConfigSchema>;

// Vincent Delegation Request
export const VincentDelegationRequestSchema = z.object({
    delegator: z.string(),
    delegatee: z.string(),
    scope: z.record(z.any()),
    expiresAt: z.string().datetime().optional(),
    signature: z.string(),
    nonce: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type VincentDelegationRequest = z.infer<typeof VincentDelegationRequestSchema>;

// Vincent Delegation Response
export const VincentDelegationResponseSchema = z.object({
    delegation: VincentDelegationRequestSchema,
    transactionHash: z.string().optional(),
    consensusTimestamp: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type VincentDelegationResponse = z.infer<typeof VincentDelegationResponseSchema>;

// Vincent Policy Evaluation Request
export const VincentPolicyEvaluationRequestSchema = z.object({
    policyId: z.string().uuid(),
    abilityParams: z.record(z.any()),
    userParams: z.record(z.any()),
    delegation: z.object({
        delegator: z.string(),
        delegatee: z.string(),
        scope: z.record(z.any()),
    }),
    metadata: z.record(z.any()).optional(),
});

export type VincentPolicyEvaluationRequest = z.infer<typeof VincentPolicyEvaluationRequestSchema>;

// Vincent Policy Evaluation Response
export const VincentPolicyEvaluationResponseSchema = z.object({
    result: VincentPolicyResultSchema,
    policyId: z.string().uuid(),
    evaluationTime: z.string().datetime(),
    metadata: z.record(z.any()).optional(),
});

export type VincentPolicyEvaluationResponse = z.infer<typeof VincentPolicyEvaluationResponseSchema>;

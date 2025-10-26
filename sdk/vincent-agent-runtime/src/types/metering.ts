import { z } from 'zod';

// Metering Data
export const MeteringDataSchema = z.object({
    sessionId: z.string().uuid(),
    totalSpent: z.string(),
    remainingBudget: z.string(),
    requestCount: z.number().nonnegative(),
    averageCost: z.string(),
    lastRequestAt: z.string().datetime().optional(),
    costBreakdown: z.array(z.object({
        requestId: z.string(),
        cost: z.string(),
        timestamp: z.string().datetime(),
        endpoint: z.string(),
        method: z.string(),
    })),
    metadata: z.record(z.any()).optional(),
});

export type MeteringData = z.infer<typeof MeteringDataSchema>;

// Spending Record
export const SpendingRecordSchema = z.object({
    recordId: z.string().uuid(),
    sessionId: z.string().uuid(),
    requestId: z.string(),
    amount: z.string(),
    currency: z.string(),
    timestamp: z.string().datetime(),
    endpoint: z.string(),
    method: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type SpendingRecord = z.infer<typeof SpendingRecordSchema>;

// Budget Configuration
export const BudgetConfigSchema = z.object({
    maxBudget: z.string(),
    currency: z.string().default('USDC'),
    resetPeriod: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'never']).optional(),
    resetTime: z.string().datetime().optional(),
    perRequestLimit: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type BudgetConfig = z.infer<typeof BudgetConfigSchema>;

// Metering Service Interface
export interface MeteringService {
    recordSpending(sessionId: string, amount: string, metadata?: any): Promise<void>;
    getMeteringData(sessionId: string): Promise<MeteringData>;
    getRemainingBudget(sessionId: string): Promise<string>;
    updateBudget(sessionId: string, amount: string): Promise<void>;
    resetBudget(sessionId: string): Promise<void>;
    isBudgetExceeded(sessionId: string, requestedAmount: string): Promise<boolean>;
    getSpendingHistory(sessionId: string, limit?: number): Promise<SpendingRecord[]>;
}

// Budget Manager Interface
export interface BudgetManager {
    setBudget(sessionId: string, config: BudgetConfig): Promise<void>;
    getBudget(sessionId: string): Promise<BudgetConfig | null>;
    checkBudget(sessionId: string, requestedAmount: string): Promise<boolean>;
    deductFromBudget(sessionId: string, amount: string): Promise<void>;
    addToBudget(sessionId: string, amount: string): Promise<void>;
    resetBudget(sessionId: string): Promise<void>;
}

// Cost Calculator Interface
export interface CostCalculator {
    calculateCost(request: any): Promise<string>;
    getCostBreakdown(request: any): Promise<any>;
}

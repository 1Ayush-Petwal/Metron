import { v4 as uuidv4 } from 'uuid';
import type { 
  MeteringService, 
  MeteringData, 
  SpendingRecord 
} from '../types/metering';

export class InMemoryMeteringService implements MeteringService {
  private spendingRecords: Map<string, SpendingRecord[]> = new Map();
  private sessionBudgets: Map<string, string> = new Map();

  async recordSpending(sessionId: string, amount: string, metadata?: any): Promise<void> {
    const record: SpendingRecord = {
      recordId: uuidv4(),
      sessionId,
      requestId: metadata?.requestId || uuidv4(),
      amount,
      currency: metadata?.currency || 'USDC',
      timestamp: new Date().toISOString(),
      endpoint: metadata?.endpoint || 'unknown',
      method: metadata?.method || 'GET',
      metadata,
    };

    const records = this.spendingRecords.get(sessionId) || [];
    records.push(record);
    this.spendingRecords.set(sessionId, records);

    // Update session budget
    const currentBudget = this.sessionBudgets.get(sessionId) || '1000000';
    const newBudget = (BigInt(currentBudget) - BigInt(amount)).toString();
    this.sessionBudgets.set(sessionId, newBudget);
  }

  async getMeteringData(sessionId: string): Promise<MeteringData> {
    const records = this.spendingRecords.get(sessionId) || [];
    const totalSpent = records.reduce((sum, record) => sum + BigInt(record.amount), BigInt(0)).toString();
    const remainingBudget = this.sessionBudgets.get(sessionId) || '1000000';
    const averageCost = records.length > 0 
      ? (BigInt(totalSpent) / BigInt(records.length)).toString()
      : '0';

    return {
      sessionId,
      totalSpent,
      remainingBudget,
      requestCount: records.length,
      averageCost,
      lastRequestAt: records.length > 0 ? records[records.length - 1].timestamp : undefined,
      costBreakdown: records.map(record => ({
        requestId: record.requestId,
        cost: record.amount,
        timestamp: record.timestamp,
        endpoint: record.endpoint,
        method: record.method,
      })),
      metadata: {
        currency: 'USDC',
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  async getRemainingBudget(sessionId: string): Promise<string> {
    return this.sessionBudgets.get(sessionId) || '1000000';
  }

  async updateBudget(sessionId: string, amount: string): Promise<void> {
    this.sessionBudgets.set(sessionId, amount);
  }

  async resetBudget(sessionId: string): Promise<void> {
    this.sessionBudgets.set(sessionId, '1000000'); // Reset to 1 USDC
  }

  async isBudgetExceeded(sessionId: string, requestedAmount: string): Promise<boolean> {
    const remainingBudget = this.sessionBudgets.get(sessionId) || '1000000';
    return BigInt(requestedAmount) > BigInt(remainingBudget);
  }

  async getSpendingHistory(sessionId: string, limit?: number): Promise<SpendingRecord[]> {
    const records = this.spendingRecords.get(sessionId) || [];
    return limit ? records.slice(-limit) : records;
  }
}

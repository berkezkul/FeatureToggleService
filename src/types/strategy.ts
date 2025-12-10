// Feature Flag Strategy types

export interface StrategyContext {
  flagId: string;
  tenantId: string;
  featureId: string;
  env: string;
  userId?: string; // For user-based evaluation
  userAttributes?: Record<string, unknown>; // Additional user context
}

export interface StrategyResult {
  enabled: boolean;
  reason?: string; // Why this result was returned
  metadata?: Record<string, unknown>; // Additional evaluation metadata
}

export interface StrategyEvaluation {
  strategyType: string;
  result: StrategyResult;
  evaluatedAt: number;
}


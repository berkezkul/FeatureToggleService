import { knexInstance } from '../config/database';
import { featureFlagModel, auditLogModel } from '../models';
import { FeatureFlagService } from './FeatureFlagService';
import { AuthService } from './AuthService';
import { RateLimitService } from './RateLimitService';
import { CacheService } from './CacheService';
import { StrategyEvaluator } from './strategies/StrategyEvaluator';
import { AuditLogService } from './AuditLogService';
import { PromotionService } from './PromotionService';

// Service instances with dependency injection
export const cacheService = new CacheService();
export const strategyEvaluator = new StrategyEvaluator();
export const auditLogService = new AuditLogService(auditLogModel);

export const featureFlagService = new FeatureFlagService(
  featureFlagModel,
  cacheService,
  strategyEvaluator,
  knexInstance
);

export const promotionService = new PromotionService(
  cacheService,
  knexInstance
);

export const authService = new AuthService();
export const rateLimitService = new RateLimitService();

export * from './FeatureFlagService';
export * from './AuthService';
export * from './RateLimitService';
export * from './CacheService';
export * from './AuditLogService';
export * from './PromotionService';
export * from './strategies';

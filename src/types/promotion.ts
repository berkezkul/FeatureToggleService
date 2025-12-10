// Environment Promotion types

import { Environment } from './index';
import { FeatureFlag } from '../models/FeatureFlag';

export interface PromotionRequest {
  tenantId: string;
  sourceEnv: Environment;
  targetEnv: Environment;
  featureIds?: string[]; // Optional: promote specific features only
  dryRun?: boolean; // Preview mode
  conflictResolution?: 'skip' | 'overwrite' | 'merge'; // How to handle conflicts
}

export interface PromotionConflict {
  featureId: string;
  featureName?: string;
  sourceValue: Partial<FeatureFlag>;
  targetValue: Partial<FeatureFlag>;
  conflictFields: string[];
}

export interface PromotionResult {
  success: boolean;
  promoted: number;
  skipped: number;
  conflicts: PromotionConflict[];
  dryRun: boolean;
  details: {
    featureId: string;
    action: 'promoted' | 'skipped' | 'conflict';
    reason?: string;
  }[];
}

export interface PromotionPreview {
  willPromote: number;
  willSkip: number;
  conflicts: PromotionConflict[];
  features: {
    featureId: string;
    featureName?: string;
    action: 'will_promote' | 'will_skip' | 'will_conflict';
    reason?: string;
  }[];
}


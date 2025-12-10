// Common types and interfaces

export type Environment = 'dev' | 'staging' | 'prod';

export type FeatureFlagStrategy = 'boolean' | 'percentage' | 'user_targeting';

export interface FeatureFlagStrategyConfig {
  boolean?: {
    enabled: boolean;
  };
  percentage?: {
    percentage: number; // 0-100
  };
  user_targeting?: {
    userIds: string[];
    enabled: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}


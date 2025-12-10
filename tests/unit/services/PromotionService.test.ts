import { PromotionService } from '../../../src/services/PromotionService';
import { FeatureFlagModel, FeatureFlag } from '../../../src/models/FeatureFlag';
import { AuditLogModel } from '../../../src/models/AuditLog';
import { CacheService } from '../../../src/services/CacheService';
import { Knex } from 'knex';
import { ValidationError } from '../../../src/utils/errors';

// Mock dependencies
const mockFeatureFlagModel = {
  findAll: jest.fn(),
  findByTenantFeatureEnv: jest.fn(),
  upsert: jest.fn(),
} as unknown as FeatureFlagModel;

const mockAuditLogModel = {
  create: jest.fn(),
} as unknown as AuditLogModel;

const mockCacheService = {
  invalidateTenantEnv: jest.fn(),
} as unknown as CacheService;

const mockDb = {
  transaction: jest.fn((callback) => callback(mockDb)),
} as unknown as Knex;

describe('PromotionService', () => {
  let service: PromotionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromotionService(
      mockFeatureFlagModel,
      mockAuditLogModel,
      mockCacheService,
      mockDb
    );
  });

  describe('promote', () => {
    it('should promote flags from dev to staging', async () => {
      const sourceFlag: FeatureFlag = {
        id: 'flag-1',
        tenant_id: 'tenant-1',
        feature_id: 'feature-1',
        env: 'dev',
        enabled: true,
        strategy_type: 'boolean',
        strategy_config: { boolean: { enabled: true } },
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockFeatureFlagModel.findAll as jest.Mock).mockResolvedValue([sourceFlag]);
      (mockFeatureFlagModel.findByTenantFeatureEnv as jest.Mock).mockResolvedValue(undefined); // No conflict
      (mockFeatureFlagModel.upsert as jest.Mock).mockResolvedValue({
        ...sourceFlag,
        env: 'staging',
      });
      (mockAuditLogModel.create as jest.Mock).mockResolvedValue({});

      const result = await service.promote({
        tenantId: 'tenant-1',
        sourceEnv: 'dev',
        targetEnv: 'staging',
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect conflicts', async () => {
      const sourceFlag: FeatureFlag = {
        id: 'flag-1',
        tenant_id: 'tenant-1',
        feature_id: 'feature-1',
        env: 'dev',
        enabled: true,
        strategy_type: 'boolean',
        strategy_config: { boolean: { enabled: true } },
        created_at: new Date(),
        updated_at: new Date(),
      };

      const targetFlag: FeatureFlag = {
        ...sourceFlag,
        id: 'flag-2',
        env: 'staging',
        enabled: false, // Conflict!
      };

      (mockFeatureFlagModel.findAll as jest.Mock).mockResolvedValue([sourceFlag]);
      (mockFeatureFlagModel.findByTenantFeatureEnv as jest.Mock).mockResolvedValue(targetFlag);

      const result = await service.promote({
        tenantId: 'tenant-1',
        sourceEnv: 'dev',
        targetEnv: 'staging',
        dryRun: false,
        conflictResolution: 'skip',
      });

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictFields).toContain('enabled');
      expect(result.skipped).toBe(1);
    });

    it('should validate promotion path', async () => {
      await expect(
        service.promote({
          tenantId: 'tenant-1',
          sourceEnv: 'prod',
          targetEnv: 'dev',
          dryRun: false,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject same source and target', async () => {
      await expect(
        service.promote({
          tenantId: 'tenant-1',
          sourceEnv: 'dev',
          targetEnv: 'dev',
          dryRun: false,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('previewPromotion', () => {
    it('should return preview without making changes', async () => {
      const sourceFlag: FeatureFlag = {
        id: 'flag-1',
        tenant_id: 'tenant-1',
        feature_id: 'feature-1',
        env: 'dev',
        enabled: true,
        strategy_type: 'boolean',
        strategy_config: { boolean: { enabled: true } },
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockFeatureFlagModel.findAll as jest.Mock).mockResolvedValue([sourceFlag]);
      (mockFeatureFlagModel.findByTenantFeatureEnv as jest.Mock).mockResolvedValue(undefined);

      const result = await service.promote({
        tenantId: 'tenant-1',
        sourceEnv: 'dev',
        targetEnv: 'staging',
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.promoted).toBe(1);
      expect(mockFeatureFlagModel.upsert).not.toHaveBeenCalled();
    });
  });

  describe('conflict resolution', () => {
    it('should overwrite on conflict when resolution is overwrite', async () => {
      const sourceFlag: FeatureFlag = {
        id: 'flag-1',
        tenant_id: 'tenant-1',
        feature_id: 'feature-1',
        env: 'dev',
        enabled: true,
        strategy_type: 'boolean',
        strategy_config: { boolean: { enabled: true } },
        created_at: new Date(),
        updated_at: new Date(),
      };

      const targetFlag: FeatureFlag = {
        ...sourceFlag,
        id: 'flag-2',
        env: 'staging',
        enabled: false,
      };

      (mockFeatureFlagModel.findAll as jest.Mock).mockResolvedValue([sourceFlag]);
      (mockFeatureFlagModel.findByTenantFeatureEnv as jest.Mock).mockResolvedValue(targetFlag);
      (mockFeatureFlagModel.upsert as jest.Mock).mockResolvedValue({
        ...sourceFlag,
        env: 'staging',
      });
      (mockAuditLogModel.create as jest.Mock).mockResolvedValue({});

      const result = await service.promote({
        tenantId: 'tenant-1',
        sourceEnv: 'dev',
        targetEnv: 'staging',
        dryRun: false,
        conflictResolution: 'overwrite',
      });

      expect(result.promoted).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockFeatureFlagModel.upsert).toHaveBeenCalled();
    });
  });
});


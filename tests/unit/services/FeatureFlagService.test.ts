import { Knex } from 'knex';
import { FeatureFlagService } from '../../../src/services/FeatureFlagService';
import { FeatureFlagModel } from '../../../src/models/FeatureFlag';
import { AuditLogModel } from '../../../src/models/AuditLog';
import { NotFoundError } from '../../../src/utils/errors';

// Mock dependencies
const mockFeatureFlagModel = {
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  findByTenantFeatureEnv: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
} as unknown as FeatureFlagModel;

const mockAuditLogModel = {
  create: jest.fn(),
} as unknown as AuditLogModel;

const mockDb = {
  transaction: jest.fn((callback) => callback(mockDb)),
} as unknown as Knex;

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeatureFlagService(mockFeatureFlagModel, mockAuditLogModel, mockDb);
  });

  describe('getFeatureFlags', () => {
    it('should return paginated feature flags', async () => {
      const mockFlags = [
        { id: '1', tenant_id: 't1', feature_id: 'f1', env: 'dev', enabled: true },
        { id: '2', tenant_id: 't1', feature_id: 'f2', env: 'dev', enabled: false },
      ];

      (mockFeatureFlagModel.findAll as jest.Mock).mockResolvedValue(mockFlags);
      (mockFeatureFlagModel.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getFeatureFlags({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockFlags);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });
  });

  describe('getFeatureFlagById', () => {
    it('should return feature flag when found', async () => {
      const mockFlag = { id: '1', tenant_id: 't1', feature_id: 'f1', env: 'dev', enabled: true };
      (mockFeatureFlagModel.findById as jest.Mock).mockResolvedValue(mockFlag);

      const result = await service.getFeatureFlagById('1');

      expect(result).toEqual(mockFlag);
      expect(mockFeatureFlagModel.findById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundError when flag not found', async () => {
      (mockFeatureFlagModel.findById as jest.Mock).mockResolvedValue(undefined);

      await expect(service.getFeatureFlagById('1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createOrUpdateFeatureFlag', () => {
    it('should create new flag and audit log', async () => {
      const input = {
        tenant_id: 't1',
        feature_id: 'f1',
        env: 'dev' as const,
        enabled: true,
      };

      const createdFlag = { id: '1', ...input };
      (mockFeatureFlagModel.findByTenantFeatureEnv as jest.Mock).mockResolvedValue(undefined);
      (mockFeatureFlagModel.upsert as jest.Mock).mockResolvedValue(createdFlag);
      (mockAuditLogModel.create as jest.Mock).mockResolvedValue({});

      const result = await service.createOrUpdateFeatureFlag(input, 'user1');

      expect(result).toEqual(createdFlag);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity_type: 'feature_flag',
          actor: 'user1',
        })
      );
    });

    it('should update existing flag and audit log', async () => {
      const input = {
        tenant_id: 't1',
        feature_id: 'f1',
        env: 'dev' as const,
        enabled: true,
      };

      const existingFlag = { id: '1', ...input, enabled: false };
      const updatedFlag = { id: '1', ...input, enabled: true };

      (mockFeatureFlagModel.findByTenantFeatureEnv as jest.Mock).mockResolvedValue(existingFlag);
      (mockFeatureFlagModel.upsert as jest.Mock).mockResolvedValue(updatedFlag);
      (mockAuditLogModel.create as jest.Mock).mockResolvedValue({});

      const result = await service.createOrUpdateFeatureFlag(input, 'user1');

      expect(result).toEqual(updatedFlag);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          old_value: expect.any(Object),
          new_value: expect.any(Object),
        })
      );
    });
  });

  describe('deleteFeatureFlag', () => {
    it('should delete flag and create audit log', async () => {
      const flag = { id: '1', tenant_id: 't1', feature_id: 'f1', env: 'dev' as const, enabled: true };
      (mockFeatureFlagModel.findById as jest.Mock).mockResolvedValue(flag);
      (mockFeatureFlagModel.delete as jest.Mock).mockResolvedValue(true);
      (mockAuditLogModel.create as jest.Mock).mockResolvedValue({});

      await service.deleteFeatureFlag('1', 'user1');

      expect(mockFeatureFlagModel.delete).toHaveBeenCalledWith('1');
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          entity_id: '1',
          actor: 'user1',
          old_value: expect.any(Object),
        })
      );
    });

    it('should throw NotFoundError when flag not found', async () => {
      (mockFeatureFlagModel.findById as jest.Mock).mockResolvedValue(undefined);

      await expect(service.deleteFeatureFlag('1', 'user1')).rejects.toThrow(NotFoundError);
    });
  });
});


import { AuditLogService } from '../../../src/services/AuditLogService';
import { AuditLogModel, AuditLog, AuditLogInput, AuditAction } from '../../../src/models/AuditLog';

// Mock model
const mockAuditLogModel = {
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
} as unknown as AuditLogModel;

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditLogService(mockAuditLogModel);
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          action: 'CREATE',
          entity_type: 'feature_flag',
          entity_id: 'flag-1',
          actor: 'user-1',
          old_value: null,
          new_value: { enabled: true },
          metadata: null,
          created_at: new Date(),
        },
      ];

      (mockAuditLogModel.findAll as jest.Mock).mockResolvedValue(mockLogs);
      (mockAuditLogModel.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getAuditLogs({
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual(mockLogs);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should filter by entity type', async () => {
      (mockAuditLogModel.findAll as jest.Mock).mockResolvedValue([]);
      (mockAuditLogModel.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogs({
        entity_type: 'feature_flag',
        page: 1,
        limit: 10,
      });

      expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'feature_flag',
        })
      );
    });
  });

  describe('getAuditLogsForEntity', () => {
    it('should get logs for specific entity', async () => {
      (mockAuditLogModel.findAll as jest.Mock).mockResolvedValue([]);
      (mockAuditLogModel.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogsForEntity('feature_flag', 'flag-1', {
        page: 1,
        limit: 10,
      });

      expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'feature_flag',
          entity_id: 'flag-1',
        })
      );
    });
  });

  describe('getAuditLogsForActor', () => {
    it('should get logs for specific actor', async () => {
      (mockAuditLogModel.findAll as jest.Mock).mockResolvedValue([]);
      (mockAuditLogModel.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogsForActor('user-1', {
        page: 1,
        limit: 10,
      });

      expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'user-1',
        })
      );
    });
  });

  describe('getAuditLogsByAction', () => {
    it('should get logs for specific action', async () => {
      (mockAuditLogModel.findAll as jest.Mock).mockResolvedValue([]);
      (mockAuditLogModel.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogsByAction('CREATE', {
        page: 1,
        limit: 10,
      });

      expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
        })
      );
    });
  });

  describe('getAuditLogsInDateRange', () => {
    it('should get logs in date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      (mockAuditLogModel.findAll as jest.Mock).mockResolvedValue([]);
      (mockAuditLogModel.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogsInDateRange(startDate, endDate, {
        page: 1,
        limit: 10,
      });

      expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: startDate,
          end_date: endDate,
        })
      );
    });

    it('should throw error if start date is after end date', async () => {
      const startDate = new Date('2025-01-31');
      const endDate = new Date('2025-01-01');

      await expect(
        service.getAuditLogsInDateRange(startDate, endDate)
      ).rejects.toThrow('Start date must be before end date');
    });
  });

  describe('calculateDiff', () => {
    it('should calculate diff between old and new values', () => {
      const oldValue = { enabled: false, name: 'test' };
      const newValue = { enabled: true, name: 'test' };

      const diff = service.calculateDiff(oldValue, newValue);

      expect(diff.enabled).toEqual({ old: false, new: true });
      expect(diff.name).toBeUndefined(); // Same value, not in diff
    });

    it('should handle null old value', () => {
      const newValue = { enabled: true };

      const diff = service.calculateDiff(null, newValue);

      expect(diff.enabled).toEqual({ old: undefined, new: true });
    });

    it('should handle null new value', () => {
      const oldValue = { enabled: true };

      const diff = service.calculateDiff(oldValue, null);

      expect(diff.enabled).toEqual({ old: true, new: undefined });
    });
  });
});


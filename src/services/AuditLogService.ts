import { AuditLogModel, AuditLog, AuditLogQuery, AuditLogInput } from '../models/AuditLog';
import { PaginatedResponse } from '../types';
import logger from '../config/logger';

/**
 * Audit Log Service
 * 
 * Handles audit log operations with filtering and pagination
 */
export class AuditLogService {
  constructor(private auditLogModel: AuditLogModel) {}

  /**
   * Get audit logs with pagination and filtering
   */
  async getAuditLogs(query: AuditLogQuery): Promise<PaginatedResponse<AuditLog>> {
    try {
      const [logs, total] = await Promise.all([
        this.auditLogModel.findAll(query),
        this.auditLogModel.count(query),
      ]);

      return {
        data: logs,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 10,
          total,
          totalPages: Math.ceil(total / (query.limit || 10)),
        },
      };
    } catch (error) {
      logger.error('Failed to get audit logs', {
        error,
        query,
      });
      throw error;
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getAuditLogsForEntity(
    entityType: string,
    entityId: string,
    query: Omit<AuditLogQuery, 'entity_type' | 'entity_id'> = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    return this.getAuditLogs({
      ...query,
      entity_type: entityType,
      entity_id: entityId,
    });
  }

  /**
   * Get audit logs for a specific actor
   */
  async getAuditLogsForActor(
    actor: string,
    query: Omit<AuditLogQuery, 'actor'> = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    return this.getAuditLogs({
      ...query,
      actor,
    });
  }

  /**
   * Get audit logs by action type
   */
  async getAuditLogsByAction(
    action: AuditLogQuery['action'],
    query: Omit<AuditLogQuery, 'action'> = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    if (!action) {
      throw new Error('Action is required');
    }

    return this.getAuditLogs({
      ...query,
      action,
    });
  }

  /**
   * Get audit logs in date range
   */
  async getAuditLogsInDateRange(
    startDate: Date,
    endDate: Date,
    query: Omit<AuditLogQuery, 'start_date' | 'end_date'> = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    return this.getAuditLogs({
      ...query,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /**
   * Create audit log entry
   * This is typically called by other services, not directly by API
   */
  async createAuditLog(data: AuditLogInput): Promise<AuditLog> {
    try {
      const log = await this.auditLogModel.create(data);
      logger.debug('Audit log created', {
        logId: log.id,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
      });
      return log;
    } catch (error) {
      logger.error('Failed to create audit log', {
        error,
        data,
      });
      throw error;
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id: string): Promise<AuditLog | null> {
    try {
      const log = await this.auditLogModel.findById(id);
      return log || null;
    } catch (error) {
      logger.error('Failed to get audit log by ID', {
        error,
        id,
      });
      return null;
    }
  }

  /**
   * Calculate diff between old and new values
   */
  calculateDiff(oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null): Record<string, { old: unknown; new: unknown }> {
    if (!oldValue && !newValue) {
      return {};
    }

    if (!oldValue) {
      return Object.keys(newValue || {}).reduce((acc, key) => {
        acc[key] = { old: undefined, new: newValue![key] };
        return acc;
      }, {} as Record<string, { old: unknown; new: unknown }>);
    }

    if (!newValue) {
      return Object.keys(oldValue).reduce((acc, key) => {
        acc[key] = { old: oldValue[key], new: undefined };
        return acc;
      }, {} as Record<string, { old: unknown; new: unknown }>);
    }

    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    const diff: Record<string, { old: unknown; new: unknown }> = {};

    for (const key of allKeys) {
      const oldVal = oldValue[key];
      const newVal = newValue[key];

      // Only include if values are different
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal, new: newVal };
      }
    }

    return diff;
  }
}


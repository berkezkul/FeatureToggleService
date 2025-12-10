import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { auditLogService } from '../services';
import { sendSuccess } from '../utils/response';
import { validate } from '../middleware/validator';
import { authenticationMiddleware } from '../middleware/authentication';
import { requireAuth, requireTenantFromRequest } from '../middleware/authorization';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { AuditLogQuery, AuditAction } from '../models/AuditLog';
import { NotFoundError } from '../utils/errors';

const router = Router();

// Validation schemas
const getAuditLogsSchema = z.object({
  query: z.object({
    entity_type: z.string().optional(),
    entity_id: z.string().uuid().optional(),
    actor: z.string().optional(),
    action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
    start_date: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
    end_date: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

const getAuditLogByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: List audit logs with pagination and filtering
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: entity_type
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *       - in: query
 *         name: entity_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by entity ID
 *       - in: query
 *         name: actor
 *         schema:
 *           type: string
 *         description: Filter by actor
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [CREATE, UPDATE, DELETE]
 *         description: Filter by action type
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of audit logs
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// GET /audit-logs - List audit logs with pagination and filtering
router.get(
  '/',
  authenticationMiddleware.authenticate,
  requireAuth,
  requireTenantFromRequest,
  rateLimitMiddleware.create({
    config: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      burst: 20,
    },
  }),
  validate(getAuditLogsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        entity_type,
        entity_id,
        actor,
        action,
        start_date,
        end_date,
        page = '1',
        limit = '10',
      } = req.query;

      const query: AuditLogQuery = {
        entity_type: entity_type as string | undefined,
        entity_id: entity_id as string | undefined,
        actor: actor as string | undefined,
        action: action as AuditAction | undefined,
        start_date: start_date as Date | undefined,
        end_date: end_date as Date | undefined,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      };

      // Validate date range if both provided
      if (query.start_date && query.end_date && query.start_date > query.end_date) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Start date must be before end date',
          },
        });
      }

      const response = await auditLogService.getAuditLogs(query);
      return sendSuccess(res, response);
    } catch (error) {
      return next(error);
    }
  }
);

// GET /audit-logs/:id - Get specific audit log
router.get(
  '/:id',
  authenticationMiddleware.authenticate,
  requireAuth,
  requireTenantFromRequest,
  rateLimitMiddleware.create({
    config: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      burst: 20,
    },
  }),
  validate(getAuditLogByIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const log = await auditLogService.getAuditLogById(id);
      if (!log) {
        throw new NotFoundError('Audit log', id);
      }

      sendSuccess(res, log);
    } catch (error) {
      next(error);
    }
  }
);

// GET /audit-logs/entity/:entityType/:entityId - Get audit logs for specific entity
router.get(
  '/entity/:entityType/:entityId',
  authenticationMiddleware.authenticate,
  requireAuth,
  requireTenantFromRequest,
  rateLimitMiddleware.create({
    config: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      burst: 20,
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entityType, entityId } = req.params;
      const { page = '1', limit = '10' } = req.query;

      const response = await auditLogService.getAuditLogsForEntity(
        entityType,
        entityId,
        {
          page: parseInt(page as string, 10),
          limit: parseInt(limit as string, 10),
        }
      );

      sendSuccess(res, response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /audit-logs/actor/:actor - Get audit logs for specific actor
router.get(
  '/actor/:actor',
  authenticationMiddleware.authenticate,
  requireAuth,
  requireTenantFromRequest,
  rateLimitMiddleware.create({
    config: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      burst: 20,
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req.params;
      const { page = '1', limit = '10' } = req.query;

      const response = await auditLogService.getAuditLogsForActor(actor, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });

      sendSuccess(res, response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;


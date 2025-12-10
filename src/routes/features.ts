import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { featureFlagService } from '../services';
import { sendSuccess } from '../utils/response';
import { validate } from '../middleware/validator';
import { authenticationMiddleware } from '../middleware/authentication';
import { requireAuth, requireTenantFromRequest } from '../middleware/authorization';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { Environment } from '../types';
import { StrategyContext } from '../types/strategy';

const router = Router();

// Validation schemas
const createFeatureFlagSchema = z.object({
  body: z.object({
    tenant_id: z.string().uuid(),
    feature_id: z.string().uuid(),
    env: z.enum(['dev', 'staging', 'prod']),
    enabled: z.boolean().optional(),
    strategy_type: z.enum(['boolean', 'percentage', 'user_targeting']).optional(),
    strategy_config: z.record(z.unknown()).optional(),
  }),
});

const deleteFeatureFlagSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Validation schema update for userId (optional)
const getFeaturesSchemaWithUser = z.object({
  query: z.object({
    tenant: z.string().uuid().optional(),
    env: z.enum(['dev', 'staging', 'prod']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    userId: z.string().uuid().optional(), // For strategy evaluation
  }),
});

/**
 * @swagger
 * /api/v1/features:
 *   get:
 *     summary: List feature flags with pagination
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: tenant
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID to filter by
 *       - in: query
 *         name: env
 *         schema:
 *           type: string
 *           enum: [dev, staging, prod]
 *         description: Environment to filter by
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID for strategy evaluation (optional)
 *     responses:
 *       200:
 *         description: List of feature flags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FeatureFlag'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
// GET /features - List feature flags with pagination and strategy evaluation
router.get(
  '/',
  authenticationMiddleware.authenticate,
  requireAuth,
  requireTenantFromRequest,
  rateLimitMiddleware.create({
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // Sustained limit
      burst: 20, // Burst limit
    },
  }),
  validate(getFeaturesSchemaWithUser),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenant, env, page = '1', limit = '10', userId } = req.query;

      const query = {
        tenant_id: tenant as string | undefined,
        env: env as Environment | undefined,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      };

      // Build strategy context if userId provided
      const context: StrategyContext | undefined = query.tenant_id && query.env
        ? {
            flagId: '', // Will be set per flag
            tenantId: query.tenant_id,
            featureId: '', // Will be set per flag
            env: query.env,
            userId: userId as string | undefined,
          }
        : undefined;

      const response = await featureFlagService.getFeatureFlags(query, context);
      sendSuccess(res, response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/features:
 *   post:
 *     summary: Create or update a feature flag
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenant_id
 *               - feature_id
 *               - env
 *             properties:
 *               tenant_id:
 *                 type: string
 *                 format: uuid
 *               feature_id:
 *                 type: string
 *                 format: uuid
 *               env:
 *                 type: string
 *                 enum: [dev, staging, prod]
 *               enabled:
 *                 type: boolean
 *               strategy_type:
 *                 type: string
 *                 enum: [boolean, percentage, user_targeting]
 *               strategy_config:
 *                 type: object
 *     responses:
 *       201:
 *         description: Feature flag created/updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FeatureFlag'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// POST /features - Create or update a feature flag
router.post(
  '/',
  authenticationMiddleware.authenticate,
  requireAuth,
  requireTenantFromRequest,
  rateLimitMiddleware.create({
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // Lower limit for write operations
      burst: 10,
    },
  }),
  validate(createFeatureFlagSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract actor from authentication
      const actor = req.user?.userId || req.apiKey?.keyId || 'system';
      const flag = await featureFlagService.createOrUpdateFeatureFlag(req.body, actor);
      sendSuccess(res, flag, 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/features/{id}:
 *   delete:
 *     summary: Delete a feature flag
 *     tags: [Features]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Feature flag ID
 *     responses:
 *       200:
 *         description: Feature flag deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// DELETE /features/:id - Delete a feature flag
router.delete(
  '/:id',
  authenticationMiddleware.authenticate,
  requireAuth,
  requireTenantFromRequest,
  rateLimitMiddleware.create({
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 30, // Lower limit for delete operations
      burst: 5,
    },
  }),
  validate(deleteFeatureFlagSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      // Extract actor from authentication
      const actor = req.user?.userId || req.apiKey?.keyId || 'system';
      await featureFlagService.deleteFeatureFlag(id, actor);
      sendSuccess(res, { message: 'Feature flag deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;


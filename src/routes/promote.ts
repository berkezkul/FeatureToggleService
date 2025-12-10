import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { promotionService } from '../services';
import { sendSuccess } from '../utils/response';
import { validate } from '../middleware/validator';
import { authenticationMiddleware } from '../middleware/authentication';
import { requireAuth, requireTenantFromRequest } from '../middleware/authorization';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { Environment } from '../types';

const router = Router();

// Validation schema
const promoteSchema = z.object({
  body: z.object({
    tenant_id: z.string().uuid(),
    source_env: z.enum(['dev', 'staging', 'prod']),
    target_env: z.enum(['dev', 'staging', 'prod']),
    feature_ids: z.array(z.string().uuid()).optional(),
    dry_run: z.boolean().optional().default(false),
    conflict_resolution: z.enum(['skip', 'overwrite', 'merge']).optional().default('skip'),
  }),
});

/**
 * @swagger
 * /api/v1/promote:
 *   post:
 *     summary: Promote feature flags between environments
 *     tags: [Promotion]
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
 *               - source_env
 *               - target_env
 *             properties:
 *               tenant_id:
 *                 type: string
 *                 format: uuid
 *               source_env:
 *                 type: string
 *                 enum: [dev, staging, prod]
 *               target_env:
 *                 type: string
 *                 enum: [dev, staging, prod]
 *               feature_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Optional - promote specific features only
 *               dry_run:
 *                 type: boolean
 *                 default: false
 *                 description: Preview mode - no changes made
 *               conflict_resolution:
 *                 type: string
 *                 enum: [skip, overwrite, merge]
 *                 default: skip
 *     responses:
 *       201:
 *         description: Feature flags promoted successfully
 *       200:
 *         description: Dry-run preview
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
// POST /promote - Promote feature flags between environments
router.post(
  '/',
  authenticationMiddleware.authenticate,
  requireAuth,
  requireTenantFromRequest,
  rateLimitMiddleware.create({
    config: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 20, // Lower limit for write operations
      burst: 5,
    },
  }),
  validate(promoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        tenant_id,
        source_env,
        target_env,
        feature_ids,
        dry_run = false,
        conflict_resolution = 'skip',
      } = req.body;

      // Extract actor from authentication
      const actor = req.user?.userId || req.apiKey?.keyId || 'system';

      const result = await promotionService.promote(
        {
          tenantId: tenant_id,
          sourceEnv: source_env as Environment,
          targetEnv: target_env as Environment,
          featureIds: feature_ids,
          dryRun: dry_run,
          conflictResolution: conflict_resolution as 'skip' | 'overwrite' | 'merge',
        },
        actor
      );

      sendSuccess(res, result, dry_run ? 200 : 201);
    } catch (error) {
      next(error);
    }
  }
);

export default router;


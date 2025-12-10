import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services';
import { sendSuccess } from '../utils/response';
import { validate } from '../middleware/validator';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    tenantId: z.string().uuid(),
    email: z.string().email().optional(),
    roles: z.array(z.string()).optional(),
  }),
});

const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string(),
  }),
});

const generateAPIKeySchema = z.object({
  body: z.object({
    keyId: z.string(),
    tenantId: z.string().uuid(),
    permissions: z.array(z.string()).optional(),
    expiresInDays: z.number().int().positive().optional(),
  }),
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Generate JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - tenantId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *               email:
 *                 type: string
 *                 format: email
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Token pair generated
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
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresIn:
 *                       type: integer
 */
// POST /auth/login - Generate JWT token (for testing/demo)
router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, tenantId, email, roles } = req.body;
      const tokenPair = authService.generateTokenPair({
        userId,
        tenantId,
        email,
        roles,
      });

      sendSuccess(res, tokenPair);
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/refresh - Refresh access token
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const payload = await authService.verifyToken(refreshToken);

      // Generate new access token
      const accessToken = authService.generateAccessToken({
        userId: payload.userId,
        tenantId: payload.tenantId,
        email: payload.email,
        roles: payload.roles,
      });

      sendSuccess(res, {
        accessToken,
        expiresIn: 3600, // 1 hour default
      });
    } catch (error) {
      next(new UnauthorizedError('Invalid or expired refresh token'));
    }
  }
);

// POST /auth/logout - Blacklist token
router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await authService.blacklistToken(token);
      }

      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/api-key/generate - Generate API key (admin only)
router.post(
  '/api-key/generate',
  validate(generateAPIKeySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { keyId, tenantId, permissions, expiresInDays } = req.body;

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const apiKey = authService.generateAPIKey({
        keyId,
        tenantId,
        permissions,
        expiresAt,
      });

      sendSuccess(res, {
        apiKey,
        keyId,
        tenantId,
        expiresAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;


import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import logger from '../config/logger';

/**
 * Require authentication (must be used after authentication middleware)
 */
export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.auth || !req.auth.authenticated) {
    throw new UnauthorizedError('Authentication required');
  }
  next();
};

/**
 * Require specific tenant access
 */
export const requireTenant = (tenantId?: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !req.auth.authenticated) {
      throw new UnauthorizedError('Authentication required');
    }

    const userTenantId = req.user?.tenantId || req.apiKey?.tenantId;
    if (!userTenantId) {
      throw new ForbiddenError('Tenant information not found in token');
    }

    // If specific tenant is required, check match
    if (tenantId && userTenantId !== tenantId) {
      logger.warn('Tenant access denied', {
        required: tenantId,
        provided: userTenantId,
        userId: req.user?.userId || req.apiKey?.keyId,
      });
      throw new ForbiddenError('Access denied for this tenant');
    }

    // Attach tenant ID to request for use in routes
    req.headers['x-tenant-id'] = userTenantId;
    next();
  };
};

/**
 * Require tenant from query parameter or body
 */
export const requireTenantFromRequest = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.auth || !req.auth.authenticated) {
    throw new UnauthorizedError('Authentication required');
  }

  const userTenantId = req.user?.tenantId || req.apiKey?.tenantId;
  if (!userTenantId) {
    throw new ForbiddenError('Tenant information not found in token');
  }

  // Get tenant from query or body
  const requestedTenantId = (req.query.tenant as string) || req.body.tenant_id;

  // If tenant is specified in request, verify it matches user's tenant
  if (requestedTenantId && requestedTenantId !== userTenantId) {
    logger.warn('Tenant mismatch in request', {
      requested: requestedTenantId,
      userTenant: userTenantId,
      userId: req.user?.userId || req.apiKey?.keyId,
    });
    throw new ForbiddenError('Access denied: tenant mismatch');
  }

  // Attach tenant ID to request
  req.headers['x-tenant-id'] = userTenantId;
  next();
};

/**
 * Require specific role
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !req.auth.authenticated) {
      throw new UnauthorizedError('Authentication required');
    }

    const userRoles = req.user?.roles || [];
    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      logger.warn('Role access denied', {
        required: roles,
        userRoles,
        userId: req.user?.userId,
      });
      throw new ForbiddenError(`Access denied: requires one of [${roles.join(', ')}]`);
    }

    next();
  };
};

/**
 * Require specific permission (for API keys)
 */
export const requirePermission = (...permissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !req.auth.authenticated) {
      throw new UnauthorizedError('Authentication required');
    }

    // For API keys, check permissions
    if (req.apiKey) {
      const apiKeyPermissions = req.apiKey.permissions || [];
      const hasPermission = permissions.some((perm) =>
        apiKeyPermissions.includes(perm)
      );

      if (!hasPermission) {
        logger.warn('Permission access denied', {
          required: permissions,
          apiKeyPermissions,
          keyId: req.apiKey.keyId,
        });
        throw new ForbiddenError(
          `Access denied: requires one of [${permissions.join(', ')}]`
        );
      }
    }

    // For JWT users, check roles (can be extended)
    if (req.user) {
      // For now, allow all authenticated users
      // Can be extended to check specific permissions
    }

    next();
  };
};


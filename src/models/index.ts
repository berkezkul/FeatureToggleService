import { knexInstance } from '../config/database';
import { TenantModel } from './Tenant';
import { FeatureModel } from './Feature';
import { FeatureFlagModel } from './FeatureFlag';
import { AuditLogModel } from './AuditLog';

export const tenantModel = new TenantModel(knexInstance);
export const featureModel = new FeatureModel(knexInstance);
export const featureFlagModel = new FeatureFlagModel(knexInstance);
export const auditLogModel = new AuditLogModel(knexInstance);

export * from './Tenant';
export * from './Feature';
export * from './FeatureFlag';
export * from './AuditLog';


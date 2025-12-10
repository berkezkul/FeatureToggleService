import { Router } from 'express';
import featuresRouter from './features';
import authRouter from './auth';
import auditLogsRouter from './auditLogs';
import promoteRouter from './promote';

const router = Router();

// Public routes
router.use('/auth', authRouter);

// Protected routes
router.use('/features', featuresRouter);
router.use('/audit-logs', auditLogsRouter);
router.use('/promote', promoteRouter);

export default router;


import { Router, Request, Response } from 'express';
import { metrics } from '../utils/metrics';
import { authenticationMiddleware } from '../middleware/authentication';
import { requireAuth } from '../middleware/authorization';

const router = Router();

// GET /metrics - Prometheus metrics endpoint
router.get(
  '/',
  authenticationMiddleware.authenticate,
  requireAuth,
  (_req: Request, res: Response) => {
    try {
      const prometheusFormat = metrics.getPrometheusFormat();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.status(200).send(prometheusFormat);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: 'Failed to generate metrics',
        },
      });
    }
  }
);

// GET /metrics/json - Metrics in JSON format
router.get(
  '/json',
  authenticationMiddleware.authenticate,
  requireAuth,
  (_req: Request, res: Response) => {
    try {
      const jsonMetrics = metrics.getJSON();
      res.status(200).json({
        success: true,
        data: jsonMetrics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: 'Failed to generate metrics',
        },
      });
    }
  }
);

export default router;


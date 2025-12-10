import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import logger from './config/logger';
import { closeDatabaseConnections } from './config/database';
import { closeRedisConnection } from './config/redis';

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression middleware
app.use(compression());

// Request ID and logging middleware (must be early in the chain)
import { requestLogger } from './middleware/requestLogger';
app.use(requestLogger);

// Metrics collection middleware
import { metricsMiddleware } from './middleware/metrics';
app.use(metricsMiddleware);

// Enhanced health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check database connection
    const { pool } = await import('./config/database');
    await pool.query('SELECT 1');
    health.checks.database = 'healthy';
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check Redis connection
    const { redis } = await import('./config/redis');
    await redis.ping();
    health.checks.redis = 'healthy';
  } catch (error) {
    health.checks.redis = 'unhealthy';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API Documentation (Swagger) - Public endpoint
import swaggerRouter from './routes/swagger';
app.use('/api-docs', swaggerRouter);

// API routes
import apiRoutes from './routes';
app.use('/api/v1', apiRoutes);

// Metrics endpoint (before 404 handler)
import metricsRouter from './routes/metrics';
app.use('/metrics', metricsRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handling middleware
import { errorHandler } from './middleware/errorHandler';
app.use(errorHandler);

// Start server
const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`, {
    environment: config.nodeEnv,
    port: PORT,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connections
      await closeDatabaseConnections();
      
      // Close Redis connection
      await closeRedisConnection();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error });
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason });
  gracefulShutdown('unhandledRejection');
});

export default app;


import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const isProduction = config.nodeEnv === 'production';

// Use a loosely-typed options object to avoid tight coupling to swagger-jsdoc types
const options: any = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Zebra Electronics Feature Toggle Service API',
      version: '1.0.0',
      description: 'Multi-tenant Feature Toggle Service - RESTful API for managing feature flags',
      contact: {
        name: 'API Support',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/v1/auth/login',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API Key for service-to-service authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Validation failed',
                },
                details: {
                  type: 'object',
                },
              },
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
            },
          },
        },
        FeatureFlag: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            tenant_id: {
              type: 'string',
              format: 'uuid',
            },
            feature_id: {
              type: 'string',
              format: 'uuid',
            },
            env: {
              type: 'string',
              enum: ['dev', 'staging', 'prod'],
            },
            enabled: {
              type: 'boolean',
            },
            strategy_type: {
              type: 'string',
              enum: ['boolean', 'percentage', 'user_targeting'],
            },
            strategy_config: {
              type: 'object',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
            evaluated: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                },
                reason: {
                  type: 'string',
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1,
            },
            limit: {
              type: 'integer',
              example: 10,
            },
            total: {
              type: 'integer',
              example: 100,
            },
            totalPages: {
              type: 'integer',
              example: 10,
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Authentication required',
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          headers: {
            'Retry-After': {
              schema: {
                type: 'integer',
              },
              description: 'Seconds to wait before retrying',
            },
          },
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        apiKeyAuth: [],
      },
    ],
  },
  // In development, read annotations from TypeScript source.
  // In production (Docker image), only compiled JS in dist/ exists.
  apis: isProduction
    ? ['./dist/routes/*.js', './dist/app.js']
    : ['./src/routes/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);


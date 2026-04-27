import swaggerJsdoc from 'swagger-jsdoc';
import { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Señoriales API',
      version: '1.0.0',
      description:
        'API del backend monolito de Señoriales. Cubre auth, sesiones de práctica, escenarios, integraciones de ElevenLabs y endpoints administrativos.',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Desarrollo local' },
      { url: 'https://centro-de-negocios.org', description: 'Producción' },
    ],
    tags: [
      { name: 'Auth', description: 'Registro, login, refresh, perfil del usuario.' },
      { name: 'Sessions', description: 'Sesiones de práctica + evaluación.' },
      { name: 'Scenarios', description: 'Escenarios de objeción/llamada.' },
      { name: 'ElevenLabs', description: 'Tokens de conversación + tools del agente.' },
      { name: 'Admin', description: 'Endpoints restringidos a rol admin.' },
      { name: 'Users', description: 'Acciones del usuario autenticado sobre su propia cuenta.' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Invalid credentials' },
          },
        },
        AuthUser: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            examenFinalEnabled: { type: 'boolean' },
            level2Unlocked: { type: 'boolean' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/AuthUser' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
        PracticeSession: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            scenarioId: { type: 'string', format: 'uuid', nullable: true },
            durationSeconds: { type: 'integer' },
            score: { type: 'integer', nullable: true },
            passed: { type: 'boolean' },
            rating: { type: 'integer', nullable: true },
            aiFeedback: { type: 'string', nullable: true },
            connectMs: { type: 'integer', nullable: true },
            ttfaSamplesMs: { type: 'array', items: { type: 'integer' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        EvaluationResult: {
          type: 'object',
          properties: {
            score: { type: 'integer', minimum: 0, maximum: 100 },
            passed: { type: 'boolean' },
            feedback: { type: 'string' },
            breakdown: {
              type: 'object',
              properties: {
                apertura: { type: 'integer' },
                escucha_activa: { type: 'integer' },
                manejo_objeciones: { type: 'integer' },
                propuesta_valor: { type: 'integer' },
                cierre: { type: 'integer' },
              },
            },
          },
        },
        Scenario: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            objection: { type: 'string' },
            description: { type: 'string' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            voiceType: { type: 'string', enum: ['male', 'female'] },
            firstMessage: { type: 'string' },
            displayOrder: { type: 'integer' },
          },
        },
        AgentLatencyAggregate: {
          type: 'object',
          properties: {
            avg: { type: 'integer', nullable: true },
            p50: { type: 'integer', nullable: true },
            p95: { type: 'integer', nullable: true },
            count: { type: 'integer' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const spec = swaggerJsdoc(options);

export function mountSwagger(app: Express): void {
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(spec);
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Señoriales API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );
}

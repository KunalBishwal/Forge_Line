import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // ─── Global Prefix ─────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── CORS ──────────────────────────────────────────
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:8080'],
    credentials: true,
  });

  // ─── Global Pipes ─────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Global Filters & Interceptors ────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new TransformInterceptor(),
  );

  // ─── Swagger / OpenAPI ────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Forgeline API')
    .setDescription(
      'Distributed Job Scheduling Platform — REST API for managing organizations, projects, queues, jobs, and workers.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Organizations', 'Organization management')
    .addTag('Projects', 'Project management')
    .addTag('Queues', 'Queue configuration and control')
    .addTag('Jobs', 'Job creation, inspection, and management')
    .addTag('Scheduled Jobs', 'Recurring/cron job definitions')
    .addTag('Dead Letter Queue', 'Failed job management and replay')
    .addTag('Workers', 'Worker health and monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Forgeline API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  // ─── Start ────────────────────────────────────────
  const port = config.get<number>('API_PORT', 3000);
  const host = config.get<string>('API_HOST', '0.0.0.0');
  await app.listen(port, host);

  console.log(`
  ╔══════════════════════════════════════════════╗
  ║           🔥 FORGELINE API SERVER            ║
  ║──────────────────────────────────────────────║
  ║  API:     http://${host}:${port}/api/v1        ║
  ║  Swagger: http://${host}:${port}/api/docs      ║
  ║  WebSocket: ws://${host}:${port}               ║
  ╚══════════════════════════════════════════════╝
  `);
}

bootstrap();

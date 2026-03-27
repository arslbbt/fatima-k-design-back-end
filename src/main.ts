import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS — allow frontend dev server and production origin
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      process.env.FRONTEND_URL ?? '',
    ].filter(Boolean),
    credentials: true,
  });

  // Cookie parser — required for reading HttpOnly JWT cookie
  app.use(cookieParser());

  // Serve uploaded files as static assets at /files/*
  const storagePath = process.env.STORAGE_PATH || '/var/www/storage';
  const ip=process.env.PUBLIC_URL
  app.useStaticAssets(path.resolve(storagePath), { prefix: '/files' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Fatima K Design — Bridal Portal API')
    .setDescription(
      'Backend API for the Fatima K Design bridal management platform',
    )
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger docs: ${await app.getUrl()}/docs`);
  console.log(`Static files served from: ${storagePath} at /files on ip ${ip}`);
}
bootstrap();

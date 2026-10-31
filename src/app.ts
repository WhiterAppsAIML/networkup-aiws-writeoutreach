// Write Outreach - Main Application Entry Point
// ==============================================
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WriteOutreachModule } from './write-outreach/module';
import { DatabaseService } from './database/database.service';

async function bootstrap() {
  const app = await NestFactory.create(WriteOutreachModule, {
    cors: {
      origin: '*',
    },
  });

  // Initialize database connection
  const databaseService = new DatabaseService();
  await databaseService.initialize();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Write Outreach API running on port ${port}`);
}

bootstrap().catch(err => {
  console.error('Failed to start Write Outreach API:', err);
  process.exit(1);
});
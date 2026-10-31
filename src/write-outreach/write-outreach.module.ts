// Write Outreach - Module
// =====================
// Main NestJS module that ties all providers, services, and controllers together.

import { Module } from '@nestjs/common';
import { GeminiProviderAdapter } from './provider/gemini.provider';
import { GenerationService } from './generation/generation.service';
import { RecommendationService } from './recommendation.service';
import { PromptBuilderService } from './prompt/prompt-builder.service';
import { WriteOutreachController } from './write-outreach.controller';

@Module({
  providers: [
    {
      provide: 'GEMINI_PROVIDER',
      useClass: GeminiProviderAdapter,
    },
    GenerationService,
    RecommendationService,
    PromptBuilderService,
    WriteOutreachController,
  ],
  controllers: [WriteOutreachController],
  exports: [GenerationService, RecommendationService, PromptBuilderService],
})
export class WriteOutreachModule {}
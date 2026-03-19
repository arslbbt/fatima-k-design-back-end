import { Module } from '@nestjs/common';
import { BridesService } from './brides.service';
import { BridesController } from './brides.controller';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [BridesController],
  providers: [BridesService, PrismaService],
})
export class BridesModule {}

import { Module } from '@nestjs/common';
import { FittingsController } from './fittings.controller';
import { FittingsService } from './fittings.service';
import { StorageModule } from '../../common/storage/storage.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [StorageModule],
  controllers: [FittingsController],
  providers: [FittingsService, PrismaService],
})
export class FittingsModule {}

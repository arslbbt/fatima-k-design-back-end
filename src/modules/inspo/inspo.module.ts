import { Module } from '@nestjs/common';
import { InspoController } from './inspo.controller';
import { InspoService } from './inspo.service';
import { StorageModule } from '../../common/storage/storage.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [StorageModule],
  controllers: [InspoController],
  providers: [InspoService, PrismaService],
})
export class InspoModule {}

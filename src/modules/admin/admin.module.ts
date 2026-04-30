import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaService } from '../../database/prisma.service';
import { NotificationModule } from '../../common/notifications/notification.module';
import { CurrencyModule } from '../../common/currency/currency.module';

@Module({
  imports: [NotificationModule, CurrencyModule],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
})
export class AdminModule {}

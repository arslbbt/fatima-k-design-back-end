import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationModule } from '../../common/notifications/notification.module';
import { CurrencyModule } from '../../common/currency/currency.module';

@Module({
  imports: [NotificationModule, CurrencyModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService],
})
export class PaymentsModule {}

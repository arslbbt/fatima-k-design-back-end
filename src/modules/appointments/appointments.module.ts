import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsScheduler } from './appointments.scheduler';
import { PrismaService } from '../../database/prisma.service';
import { NotificationModule } from '../../common/notifications/notification.module';
import { GoogleCalendarModule } from '../../common/google-calendar/google-calendar.module';

@Module({
  imports: [NotificationModule, GoogleCalendarModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsScheduler, PrismaService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}

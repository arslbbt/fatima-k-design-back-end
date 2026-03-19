import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class AppointmentsScheduler {
  private readonly logger = new Logger(AppointmentsScheduler.name);

  constructor(private appointmentsService: AppointmentsService) {}

  // Runs every hour — checks for appointments starting in ~48hrs
  @Cron(CronExpression.EVERY_HOUR)
  async handleReminders() {
    this.logger.log('Running appointment reminder check...');
    await this.appointmentsService.sendPendingReminders();
  }
}

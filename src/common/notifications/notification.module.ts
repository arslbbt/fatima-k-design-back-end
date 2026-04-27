import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationService } from './notification.service';

@Module({
  imports: [MailModule, SmsModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

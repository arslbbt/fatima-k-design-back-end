import { Module } from '@nestjs/common';
import { MailjetService } from './mailjet.service';
import { MAIL_SERVICE } from './mail.interface';
import { IcsService } from '../ics/ics.service';

/**
 * To switch providers (e.g. to SES or Resend):
 * 1. Create a new service implementing IMailService
 * 2. Replace MailjetService with your new service below — nothing else changes
 */
@Module({
  providers: [
    IcsService,
    {
      provide: MAIL_SERVICE,
      useClass: MailjetService,
    },
  ],
  exports: [MAIL_SERVICE],
})
export class MailModule {}

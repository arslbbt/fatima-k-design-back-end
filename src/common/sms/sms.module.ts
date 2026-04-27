import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TwilioService } from './twilio.service';
import { SMS_SERVICE } from './sms.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SMS_SERVICE,
      useClass: TwilioService,
    },
  ],
  exports: [SMS_SERVICE],
})
export class SmsModule {}

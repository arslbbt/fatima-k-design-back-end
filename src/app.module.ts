import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import envConfig from './config/env.config';
import { PrismaService } from './database/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { BridesModule } from './modules/brides/brides.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FittingsModule } from './modules/fittings/fittings.module';
import { InspoModule } from './modules/inspo/inspo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [envConfig] }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AdminModule,
    BridesModule,
    AppointmentsModule,
    DocumentsModule,
    FittingsModule,
    InspoModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentTitle } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'uuid-of-bride' })
  @IsUUID()
  brideId: string;

  @ApiProperty({ enum: AppointmentTitle })
  @IsEnum(AppointmentTitle)
  title: AppointmentTitle;

  // Required when title === CUSTOM
  @ApiPropertyOptional({ example: 'Veil & Accessories Review' })
  @ValidateIf((o) => o.title === AppointmentTitle.CUSTOM)
  @IsString()
  customTitle?: string;

  @ApiPropertyOptional({ example: 'First consultation session' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Fatima K Studio, Dubai' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: '2026-04-10T10:00:00.000Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2026-04-10T11:00:00.000Z' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ example: 'Bring your inspiration photos' })
  @IsOptional()
  @IsString()
  whatToBring?: string;
}

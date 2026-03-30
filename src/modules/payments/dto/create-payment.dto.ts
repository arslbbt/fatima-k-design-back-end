import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty() @IsUUID() brideId: string;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiProperty({ example: 2500 }) @IsNumber() @Min(0.01) amount: number;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() markAsPaid?: boolean;
}

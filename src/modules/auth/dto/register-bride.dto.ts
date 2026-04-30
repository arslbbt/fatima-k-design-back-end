import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { BrideType, AppointmentTitle } from '@prisma/client';

export class RegisterBrideDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 6 }) @IsString() @MinLength(6) password: string;
  @ApiPropertyOptional({ enum: BrideType })
  @IsOptional()
  @IsEnum(BrideType)
  brideType?: BrideType;
  @ApiPropertyOptional() @IsOptional() @IsDateString() weddingDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partnerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venueName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({
    description: 'Country ISO code (e.g., US, AU, GB)',
    example: 'AU',
  })
  @IsOptional()
  @IsString()
  country?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalGownAmount?: number;

  // Initial payment fields
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  initialPaymentAmount?: number;
  @ApiPropertyOptional({ enum: AppointmentTitle })
  @IsOptional()
  @IsEnum(AppointmentTitle)
  initialPaymentType?: AppointmentTitle;
  @ApiPropertyOptional() @IsOptional() @IsString() initialPaymentNotes?: string;
}

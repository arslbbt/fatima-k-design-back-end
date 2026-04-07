import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { BrideType } from '@prisma/client';

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
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class RegisterBrideDto {
  @ApiProperty({ example: 'Sarah Johnson' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'sarah@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '2026-09-15' })
  @IsOptional()
  @IsDateString()
  weddingDate?: string;

  @ApiPropertyOptional({ example: '+971501234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Romantic, flowy, lace details' })
  @IsOptional()
  @IsString()
  stylePreferences?: string;

  @ApiPropertyOptional({ example: 'Prefers morning appointments' })
  @IsOptional()
  @IsString()
  notes?: string;
}

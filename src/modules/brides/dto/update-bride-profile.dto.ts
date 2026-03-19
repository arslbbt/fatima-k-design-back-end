import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateBrideProfileDto {
  @ApiPropertyOptional({ example: 'Sarah Johnson' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'sarah@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

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

  // Explicitly nullable — sending empty string or null clears the field
  @ApiPropertyOptional({
    example: 'Prefers morning appointments',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

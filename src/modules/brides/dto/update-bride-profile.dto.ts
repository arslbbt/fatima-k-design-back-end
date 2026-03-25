import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateBrideProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() weddingDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partnerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venueName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guestCount?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dietaryNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stylePreferences?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() notes?:
    | string
    | null;
}

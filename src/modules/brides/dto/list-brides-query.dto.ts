import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BrideStage, BrideType } from '@prisma/client';

export class ListBridesQueryDto {
  @ApiPropertyOptional({
    example: 'sarah',
    description: 'Search by name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: BrideStage })
  @IsOptional()
  @IsEnum(BrideStage)
  stage?: BrideStage;

  @ApiPropertyOptional({ enum: BrideType })
  @IsOptional()
  @IsEnum(BrideType)
  brideType?: BrideType;

  @ApiPropertyOptional({
    example: 'lace',
    description: 'Filter by style preferences (partial match)',
  })
  @IsOptional()
  @IsString()
  stylePreferences?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

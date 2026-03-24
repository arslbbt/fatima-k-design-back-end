import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BrideStage } from '@prisma/client';

export class UpdateBrideStageDto {
  @ApiProperty({ enum: BrideStage, example: BrideStage.FIRST_FITTING })
  @IsEnum(BrideStage)
  stage: BrideStage;
}

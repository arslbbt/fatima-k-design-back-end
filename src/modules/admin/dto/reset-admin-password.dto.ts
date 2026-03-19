import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetAdminPasswordDto {
  @ApiProperty({ example: 'NewPassword456', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

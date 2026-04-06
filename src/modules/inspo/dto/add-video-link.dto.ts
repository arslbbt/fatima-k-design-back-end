import { IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddVideoLinkDto {
  @ApiProperty({
    example: 'https://www.tiktok.com/@username/video/1234567890',
    description: 'Video URL from TikTok, Instagram, YouTube, or Pinterest',
  })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @IsString()
  videoLink: string;
}

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { FittingsService } from './fittings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateFittingDto {
  @ApiProperty() @IsUUID() appointmentId: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

const IMAGE_FILE_PIPE = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
    new FileTypeValidator({ fileType: /^image\/(jpeg|png)$/ }),
  ],
});

@ApiTags('Fittings')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fittings')
export class FittingsController {
  constructor(private fittingsService: FittingsService) {}

  @Post('bride/:brideId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — create a fitting record for a bride' })
  create(@Param('brideId') brideId: string, @Body() dto: CreateFittingDto) {
    return this.fittingsService.create(
      brideId,
      dto.appointmentId,
      dto.name,
      dto.notes,
    );
  }

  @Post(':id/photos')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — upload photos to a fitting (max 10)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadPhotos(
    @Param('id') id: string,
    @UploadedFiles(IMAGE_FILE_PIPE) files: Express.Multer.File[],
  ) {
    return this.fittingsService.uploadPhotos(id, files);
  }

  @Get('bride/:brideId')
  @Roles(Role.ADMIN, Role.BRIDE)
  @ApiOperation({ summary: 'List fittings with photos for a bride' })
  listForBride(
    @Param('brideId') brideId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    // Brides can only see their own fittings
    const targetId = user.role === 'BRIDE' ? user.id : brideId;
    return this.fittingsService.listForBride(targetId);
  }

  @Delete('photos/:photoId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — delete a fitting photo' })
  deletePhoto(@Param('photoId') photoId: string) {
    return this.fittingsService.deletePhoto(photoId);
  }
}

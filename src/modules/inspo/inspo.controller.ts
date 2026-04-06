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
import { InspoService } from './inspo.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AddVideoLinkDto } from './dto/add-video-link.dto';

class UploadInspoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() caption?: string;
}

const IMAGE_FILE_PIPE = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
    new FileTypeValidator({ fileType: /^image\/(jpeg|png)$/ }),
  ],
});

@ApiTags('Inspiration')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inspo')
export class InspoController {
  constructor(private inspoService: InspoService) {}

  @Post()
  @Roles(Role.BRIDE)
  @ApiOperation({ summary: 'Bride — upload inspiration images (max 5)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 5))
  upload(
    @UploadedFiles(IMAGE_FILE_PIPE) files: Express.Multer.File[],
    @Body() body: UploadInspoDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.inspoService.upload(user.id, files, body.caption);
  }

  @Post('video-link')
  @Roles(Role.BRIDE)
  @ApiOperation({ summary: 'Bride — save video link from social media' })
  addVideoLink(
    @Body() dto: AddVideoLinkDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.inspoService.addVideoLink(user.id, dto);
  }

  @Get('my')
  @Roles(Role.BRIDE)
  @ApiOperation({ summary: 'Bride — list own inspiration uploads' })
  listMine(@CurrentUser() user: { id: string }) {
    return this.inspoService.listForBride(user.id);
  }

  @Get('bride/:brideId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — list inspiration uploads for a bride' })
  listForBride(@Param('brideId') brideId: string) {
    return this.inspoService.listForBride(brideId);
  }

  @Delete(':id')
  @Roles(Role.BRIDE, Role.ADMIN)
  @ApiOperation({ summary: 'Delete an inspiration upload' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.inspoService.remove(id, user.id, user.role);
  }
}

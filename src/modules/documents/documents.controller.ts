import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UploadDocumentDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
}

@ApiTags('Documents')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post('bride/:brideId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — upload a document for a bride' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('brideId') brideId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.documentsService.upload(brideId, file, body.title, user.id);
  }

  @Get('bride/:brideId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — list documents for a bride' })
  listForBride(@Param('brideId') brideId: string) {
    return this.documentsService.listForBride(brideId);
  }

  @Get('my')
  @Roles(Role.BRIDE)
  @ApiOperation({ summary: 'Bride — view own documents' })
  listMine(@CurrentUser() user: { id: string }) {
    return this.documentsService.listForBride(user.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — delete a document' })
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}

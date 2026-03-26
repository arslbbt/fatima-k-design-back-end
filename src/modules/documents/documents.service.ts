import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async upload(
    brideId: string,
    file: Express.Multer.File,
    title: string,
    adminId: string,
  ) {
    const bride = await this.prisma.user.findFirst({
      where: { id: brideId, role: 'BRIDE' },
    });
    if (!bride) throw new NotFoundException('Bride not found');

    if (!file?.buffer) throw new BadRequestException('No file received');

    const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const fileUrl = this.storage.saveFile(
      brideId,
      'documents',
      file.originalname,
      file.buffer,
    );

    return this.prisma.document.create({
      data: {
        brideId,
        title: title.trim(),
        fileUrl,
        fileType,
        uploadedBy: adminId,
      },
    });
  }

  async listForBride(brideId: string) {
    return this.prisma.document.findMany({
      where: { brideId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async remove(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    this.storage.deleteByUrl(doc.fileUrl);
    await this.prisma.document.delete({ where: { id } });
    return { message: 'Document deleted successfully' };
  }
}

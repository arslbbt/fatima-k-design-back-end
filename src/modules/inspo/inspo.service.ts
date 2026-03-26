import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class InspoService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async upload(
    brideId: string,
    files: Express.Multer.File[],
    caption?: string,
  ) {
    if (!files?.length) throw new BadRequestException('No files received');

    const uploads = await Promise.all(
      files.map(async (file) => {
        if (!file.buffer) throw new BadRequestException('Invalid file');
        const imageUrl = this.storage.saveFile(
          brideId,
          'inspirations',
          file.originalname,
          file.buffer,
        );
        return this.prisma.inspoUpload.create({
          data: { brideId, imageUrl, caption: caption ?? null },
        });
      }),
    );

    return uploads;
  }

  async listForBride(brideId: string) {
    return this.prisma.inspoUpload.findMany({
      where: { brideId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async remove(id: string, requesterId: string, requesterRole: string) {
    const upload = await this.prisma.inspoUpload.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException('Upload not found');

    // Brides can only delete their own uploads
    if (requesterRole === 'BRIDE' && upload.brideId !== requesterId) {
      throw new ForbiddenException('You can only delete your own uploads');
    }

    this.storage.deleteByUrl(upload.imageUrl);
    await this.prisma.inspoUpload.delete({ where: { id } });
    return { message: 'Upload deleted successfully' };
  }
}

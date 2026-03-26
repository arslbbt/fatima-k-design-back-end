import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class FittingsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async create(brideId: string, appointmentId?: string, notes?: string) {
    const bride = await this.prisma.user.findFirst({
      where: { id: brideId, role: 'BRIDE' },
    });
    if (!bride) throw new NotFoundException('Bride not found');

    // Auto-increment fitting number for this bride
    const count = await this.prisma.fitting.count({ where: { brideId } });

    return this.prisma.fitting.create({
      data: {
        brideId,
        fittingNumber: count + 1,
        appointmentId: appointmentId ?? null,
        notes: notes ?? null,
      },
      include: { photos: true },
    });
  }

  async uploadPhotos(fittingId: string, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('No files received');

    const fitting = await this.prisma.fitting.findUnique({
      where: { id: fittingId },
    });
    if (!fitting) throw new NotFoundException('Fitting not found');

    const photos = await Promise.all(
      files.map(async (file) => {
        if (!file.buffer) throw new BadRequestException('Invalid file');
        const fileUrl = this.storage.saveFile(
          fitting.brideId,
          'fittings',
          file.originalname,
          file.buffer,
        );
        return this.prisma.fittingPhoto.create({
          data: { fittingId, imageUrl: fileUrl },
        });
      }),
    );

    return photos;
  }

  async listForBride(brideId: string) {
    return this.prisma.fitting.findMany({
      where: { brideId },
      include: { photos: true },
      orderBy: { fittingNumber: 'asc' },
    });
  }

  async deletePhoto(photoId: string) {
    const photo = await this.prisma.fittingPhoto.findUnique({
      where: { id: photoId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    this.storage.deleteByUrl(photo.imageUrl);
    await this.prisma.fittingPhoto.delete({ where: { id: photoId } });
    return { message: 'Photo deleted successfully' };
  }
}

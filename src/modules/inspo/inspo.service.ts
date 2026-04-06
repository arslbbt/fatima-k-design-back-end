import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { AddVideoLinkDto } from './dto/add-video-link.dto';

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
          data: {
            brideId,
            imageUrl,
            mediaType: 'image',
            caption: caption ?? null,
          },
        });
      }),
    );

    return uploads;
  }

  async addVideoLink(brideId: string, dto: AddVideoLinkDto) {
    // Detect platform (optional, for display purposes)
    const platform = this.detectPlatform(dto.videoLink) || 'other';

    return this.prisma.inspoUpload.create({
      data: {
        brideId,
        videoLink: dto.videoLink,
        mediaType: 'video_link',
        platform,
      },
    });
  }

  private detectPlatform(url: string): string | null {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be'))
      return 'youtube';
    if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it'))
      return 'pinterest';
    if (urlLower.includes('vimeo.com')) return 'vimeo';

    return null;
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

    // Only delete file from storage if it's an uploaded image
    if (upload.mediaType === 'image' && upload.imageUrl) {
      this.storage.deleteByUrl(upload.imageUrl);
    }

    await this.prisma.inspoUpload.delete({ where: { id } });
    return { message: 'Upload deleted successfully' };
  }
}

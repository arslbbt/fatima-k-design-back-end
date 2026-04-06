-- AlterTable
ALTER TABLE "inspo_uploads" ADD COLUMN     "media_type" TEXT NOT NULL DEFAULT 'image',
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "video_link" TEXT,
ALTER COLUMN "image_url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "updated_at" DROP DEFAULT;

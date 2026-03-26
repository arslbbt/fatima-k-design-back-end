-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "bride_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_bride_id_fkey" FOREIGN KEY ("bride_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

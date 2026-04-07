-- AlterTable
-- Add name column to fittings table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fittings' AND column_name = 'name'
    ) THEN
        ALTER TABLE "fittings" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Fitting Session';
        
        -- Update existing records with a default name based on fitting number
        UPDATE "fittings" SET "name" = 'Fitting Session ' || "fitting_number";
        
        -- Remove the default constraint after updating existing records
        ALTER TABLE "fittings" ALTER COLUMN "name" DROP DEFAULT;
    END IF;
END $$;

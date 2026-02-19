-- Fix pharmacies table - add missing columns
-- Run this in your Supabase SQL Editor

-- Check if address column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pharmacies'
        AND column_name = 'address'
    ) THEN
        ALTER TABLE pharmacies ADD COLUMN address TEXT;
    END IF;
END $$;

-- Add is_active column if it doesn't exist
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update any existing pharmacies with a default address if needed
-- UPDATE pharmacies SET address = 'Default Address' WHERE address IS NULL;

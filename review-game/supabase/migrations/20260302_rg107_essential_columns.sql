-- Migration: RG-107 Essential Columns (Condensed)
-- Description: Add bank access control columns to profiles table
-- Date: 2026-03-02
-- Related: RG-107, RG-108, RG-118

-- Add bank access control columns if they don't exist
DO $$
BEGIN
    -- Add accessible_prebuilt_bank_ids column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'accessible_prebuilt_bank_ids'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN accessible_prebuilt_bank_ids JSONB DEFAULT NULL
        CONSTRAINT chk_accessible_prebuilt_bank_ids_is_array
          CHECK (accessible_prebuilt_bank_ids IS NULL OR jsonb_typeof(accessible_prebuilt_bank_ids) = 'array');

        CREATE INDEX idx_profiles_accessible_banks
        ON profiles USING gin(accessible_prebuilt_bank_ids);

        RAISE NOTICE 'Added accessible_prebuilt_bank_ids column';
    END IF;

    -- Add custom_bank_limit column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'custom_bank_limit'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN custom_bank_limit INTEGER DEFAULT 0
        CONSTRAINT chk_custom_bank_limit CHECK (custom_bank_limit IS NULL OR custom_bank_limit >= 0);

        RAISE NOTICE 'Added custom_bank_limit column';
    END IF;

    -- Add custom_bank_count column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'custom_bank_count'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN custom_bank_count INTEGER DEFAULT 0 NOT NULL
        CONSTRAINT chk_custom_bank_count CHECK (custom_bank_count >= 0);

        RAISE NOTICE 'Added custom_bank_count column';
    END IF;
END $$;

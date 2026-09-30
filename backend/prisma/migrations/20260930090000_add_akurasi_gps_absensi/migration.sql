ALTER TABLE public.absensi
  ADD COLUMN IF NOT EXISTS akurasi_masuk double precision,
  ADD COLUMN IF NOT EXISTS akurasi_pulang double precision;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'absensi_akurasi_masuk_range'
  ) THEN
    ALTER TABLE public.absensi
      ADD CONSTRAINT absensi_akurasi_masuk_range
      CHECK (akurasi_masuk IS NULL OR (akurasi_masuk > 0 AND akurasi_masuk <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'absensi_akurasi_pulang_range'
  ) THEN
    ALTER TABLE public.absensi
      ADD CONSTRAINT absensi_akurasi_pulang_range
      CHECK (akurasi_pulang IS NULL OR (akurasi_pulang > 0 AND akurasi_pulang <= 100));
  END IF;
END $$;

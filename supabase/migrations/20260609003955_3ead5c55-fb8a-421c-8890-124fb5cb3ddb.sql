ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region_city text,
  ADD COLUMN IF NOT EXISTS region_district text,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;
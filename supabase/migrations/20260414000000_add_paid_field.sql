ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

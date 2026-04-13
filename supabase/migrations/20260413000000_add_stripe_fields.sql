ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;

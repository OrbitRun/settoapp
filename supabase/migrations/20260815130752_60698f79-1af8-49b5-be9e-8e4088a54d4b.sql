ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS original_currency text,
  ADD COLUMN IF NOT EXISTS original_total_minor bigint,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exchange_rate_date date,
  ADD COLUMN IF NOT EXISTS exchange_rate_source text NOT NULL DEFAULT 'same',
  ADD COLUMN IF NOT EXISTS card_charged_minor bigint;

UPDATE public.expenses
SET original_currency = COALESCE(original_currency, currency),
    original_total_minor = COALESCE(original_total_minor, total_minor),
    exchange_rate_date = COALESCE(exchange_rate_date, expense_date::date);

ALTER TABLE public.expenses
  ALTER COLUMN original_currency SET DEFAULT 'DKK',
  ALTER COLUMN original_total_minor SET DEFAULT 0;

ALTER TABLE public.expense_splits
  ADD COLUMN IF NOT EXISTS original_amount_minor bigint;

UPDATE public.expense_splits
SET original_amount_minor = COALESCE(original_amount_minor, amount_minor);

ALTER TABLE public.expense_splits
  ALTER COLUMN original_amount_minor SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate_date date NOT NULL,
  rate numeric NOT NULL,
  source text NOT NULL DEFAULT 'ecb',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency, rate_date)
);

GRANT SELECT, INSERT ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read fx rates"
  ON public.fx_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can cache fx rates"
  ON public.fx_rates FOR INSERT TO authenticated WITH CHECK (true);
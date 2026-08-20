DROP POLICY IF EXISTS "authenticated can cache fx rates" ON public.fx_rates;

REVOKE ALL ON public.fx_rates FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.fx_rates FROM authenticated;

GRANT SELECT ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;
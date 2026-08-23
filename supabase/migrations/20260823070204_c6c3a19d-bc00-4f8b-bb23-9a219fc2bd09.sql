REVOKE ALL ON public.receipts FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.receipts FROM authenticated;
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  merchant_name text,
  purchase_date date,
  currency text,
  total_minor bigint,
  parsed_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  warranty_expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipts_storage_path_canonical
    CHECK (storage_path = owner_user_id::text || '/' || id::text || '/original.jpg'),
  CONSTRAINT receipts_file_size_positive CHECK (file_size_bytes > 0),
  CONSTRAINT receipts_mime_jpeg CHECK (mime_type = 'image/jpeg'),
  CONSTRAINT receipts_currency_iso CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CONSTRAINT receipts_total_non_negative CHECK (total_minor IS NULL OR total_minor >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE INDEX receipts_owner_user_id_idx ON public.receipts (owner_user_id, created_at DESC);

CREATE TRIGGER receipts_touch
BEFORE UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.pari_touch_updated_at();

-- Identity fields are frozen after insert. SECURITY DEFINER so the comparison
-- reads the stored row without a same-table RLS recursion.
CREATE OR REPLACE FUNCTION public.receipt_identity_unchanged(
  _id uuid,
  _owner_user_id uuid,
  _storage_path text,
  _mime_type text,
  _file_size_bytes bigint
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.receipts r
    WHERE r.id = _id
      AND r.owner_user_id IS NOT DISTINCT FROM _owner_user_id
      AND r.storage_path IS NOT DISTINCT FROM _storage_path
      AND r.mime_type IS NOT DISTINCT FROM _mime_type
      AND r.file_size_bytes IS NOT DISTINCT FROM _file_size_bytes
  );
$$;

REVOKE ALL ON FUNCTION public.receipt_identity_unchanged(uuid, uuid, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receipt_identity_unchanged(uuid, uuid, text, text, bigint) TO authenticated;

CREATE POLICY "own receipts select" ON public.receipts
FOR SELECT TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "own receipts insert" ON public.receipts
FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "own receipts update" ON public.receipts
FOR UPDATE TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (
  owner_user_id = auth.uid()
  AND public.receipt_identity_unchanged(id, owner_user_id, storage_path, mime_type, file_size_bytes)
);

CREATE POLICY "own receipts delete" ON public.receipts
FOR DELETE TO authenticated
USING (owner_user_id = auth.uid());

ALTER TABLE public.expenses
  ADD COLUMN receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL;

CREATE INDEX expenses_receipt_id_idx ON public.expenses (receipt_id) WHERE receipt_id IS NOT NULL;

-- An expense may only point at a receipt the caller owns. Enforced by trigger
-- rather than policy so no permissive expenses policy can OR around it.
CREATE OR REPLACE FUNCTION public.expenses_receipt_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.receipt_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.receipt_id IS NOT DISTINCT FROM OLD.receipt_id THEN
    RETURN NEW;
  END IF;

  SELECT r.owner_user_id INTO v_owner FROM public.receipts r WHERE r.id = NEW.receipt_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'receipt not found';
  END IF;

  IF auth.uid() IS NOT NULL AND v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'receipt belongs to another account';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER expenses_receipt_link_guard
BEFORE INSERT OR UPDATE OF receipt_id ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.expenses_receipt_link_guard();
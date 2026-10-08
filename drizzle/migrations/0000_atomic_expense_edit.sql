-- One transaction for an expense edit: fields + replacement splits succeed
-- together or not at all. SECURITY INVOKER: the caller's own RLS policies
-- decide what may be written; nothing here widens access.
CREATE OR REPLACE FUNCTION public.update_expense_with_splits(
  _expense_id uuid,
  _patch jsonb,
  _replace_splits boolean,
  _splits jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _e public.expenses%ROWTYPE;
  _group uuid;
  _payer uuid;
  _n integer;
  _expected integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid_patch' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _e FROM public.expenses WHERE id = _expense_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'expense_not_found' USING ERRCODE = 'P0002';
  END IF;

  _group := CASE WHEN _patch ? 'group_id' THEN NULLIF(_patch->>'group_id', '')::uuid ELSE _e.group_id END;
  _payer := CASE WHEN _patch ? 'paid_by_person_id' THEN (_patch->>'paid_by_person_id')::uuid ELSE _e.paid_by_person_id END;

  IF _payer IS NULL THEN
    RAISE EXCEPTION 'invalid_payer' USING ERRCODE = '22023';
  END IF;
  IF _group IS NOT NULL AND (_patch ? 'paid_by_person_id' OR _patch ? 'group_id') AND NOT EXISTS (
    SELECT 1 FROM public.group_members gm WHERE gm.group_id = _group AND gm.person_id = _payer
  ) THEN
    RAISE EXCEPTION 'invalid_payer' USING ERRCODE = '22023';
  END IF;

  -- Validate replacement splits before anything destructive happens.
  IF _replace_splits THEN
    IF _splits IS NULL OR jsonb_typeof(_splits) <> 'array' THEN
      RAISE EXCEPTION 'invalid_splits' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(_splits) s
      WHERE (s->>'person_id') IS NULL
         OR (s->>'amount_minor') IS NULL
         OR (s->>'amount_minor')::bigint < 0
    ) THEN
      RAISE EXCEPTION 'invalid_splits' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(_splits))
       <> (SELECT count(DISTINCT s->>'person_id') FROM jsonb_array_elements(_splits) s) THEN
      RAISE EXCEPTION 'duplicate_participant' USING ERRCODE = '22023';
    END IF;
    IF _group IS NOT NULL AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(_splits) s
      WHERE NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = _group AND gm.person_id = (s->>'person_id')::uuid
      )
    ) THEN
      RAISE EXCEPTION 'invalid_participant' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.expenses SET
    title = CASE WHEN _patch ? 'title' THEN _patch->>'title' ELSE title END,
    merchant = CASE WHEN _patch ? 'merchant' THEN _patch->>'merchant' ELSE merchant END,
    paid_by_person_id = _payer,
    expense_date = CASE WHEN _patch ? 'expense_date' THEN (_patch->>'expense_date')::timestamptz ELSE expense_date END,
    group_id = _group,
    total_minor = CASE WHEN _patch ? 'total_minor' THEN (_patch->>'total_minor')::bigint ELSE total_minor END,
    currency = CASE WHEN _patch ? 'currency' THEN _patch->>'currency' ELSE currency END,
    original_currency = CASE WHEN _patch ? 'original_currency' THEN _patch->>'original_currency' ELSE original_currency END,
    original_total_minor = CASE WHEN _patch ? 'original_total_minor' THEN (_patch->>'original_total_minor')::bigint ELSE original_total_minor END,
    exchange_rate = CASE WHEN _patch ? 'exchange_rate' THEN (_patch->>'exchange_rate')::numeric ELSE exchange_rate END,
    exchange_rate_date = CASE WHEN _patch ? 'exchange_rate_date' THEN (_patch->>'exchange_rate_date')::date ELSE exchange_rate_date END,
    exchange_rate_source = CASE WHEN _patch ? 'exchange_rate_source' THEN _patch->>'exchange_rate_source' ELSE exchange_rate_source END,
    card_charged_minor = CASE WHEN _patch ? 'card_charged_minor' THEN (_patch->>'card_charged_minor')::bigint ELSE card_charged_minor END
  WHERE id = _expense_id;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n = 0 THEN
    RAISE EXCEPTION 'expense_update_denied' USING ERRCODE = '42501';
  END IF;

  IF _replace_splits THEN
    DELETE FROM public.expense_splits WHERE expense_id = _expense_id;
    -- Splits hidden from or protected against this caller would survive the
    -- delete; abort rather than mix old and new rows.
    IF EXISTS (SELECT 1 FROM public.expense_splits WHERE expense_id = _expense_id) THEN
      RAISE EXCEPTION 'split_replace_denied' USING ERRCODE = '42501';
    END IF;
    _expected := jsonb_array_length(_splits);
    INSERT INTO public.expense_splits
      (owner_user_id, expense_id, person_id, amount_minor, original_amount_minor, percentage, shares)
    SELECT _uid, _expense_id, (s->>'person_id')::uuid, (s->>'amount_minor')::bigint,
           NULLIF(s->>'original_amount_minor', '')::bigint,
           NULLIF(s->>'percentage', '')::numeric,
           NULLIF(s->>'shares', '')::numeric
    FROM jsonb_array_elements(_splits) s;
    GET DIAGNOSTICS _n = ROW_COUNT;
    IF _n <> _expected THEN
      RAISE EXCEPTION 'split_insert_incomplete' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN _expense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_expense_with_splits(uuid, jsonb, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_expense_with_splits(uuid, jsonb, boolean, jsonb) TO authenticated;
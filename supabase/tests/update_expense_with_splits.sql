-- Real-database rollback test for public.update_expense_with_splits.
-- Runs entirely inside BEGIN ... ROLLBACK with synthetic rows; nothing is kept.
-- Requires a role that can SET ROLE authenticated (e.g. postgres on a local/test DB).
-- Run: psql -v ON_ERROR_STOP=1 -f supabase/tests/update_expense_with_splits.sql
BEGIN;
SET LOCAL client_min_messages = warning;

-- Synthetic user / people / group / expense
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a1', 'atomic-test@example.invalid');
INSERT INTO public.people (id, owner_user_id, name, is_self, linked_profile_id, status)
VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'A', true, NULL, 'active'),
       ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'B', false, NULL, 'active'),
       ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'Outsider', false, NULL, 'active');
INSERT INTO public.groups (id, owner_user_id, name, default_split_type, currency)
VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'T', 'equal', 'DKK');
INSERT INTO public.group_members (owner_user_id, group_id, person_id, role)
VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'owner'),
       ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'member');
INSERT INTO public.expenses (id, owner_user_id, group_id, paid_by_person_id, title, currency, total_minor, source_type, exchange_rate, exchange_rate_source)
VALUES ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-0000000000b1', 'Original', 'DKK', 1000, 'manual', 1, 'none');
INSERT INTO public.expense_splits (owner_user_id, expense_id, person_id, amount_minor)
VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 500),
       ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b2', 500);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- 1. Invalid replacement (outsider) must leave everything unchanged.
DO $$ BEGIN
  PERFORM public.update_expense_with_splits('00000000-0000-0000-0000-0000000000d1',
    '{"title":"Changed","total_minor":2000}',
    true, '[{"person_id":"00000000-0000-0000-0000-0000000000b3","amount_minor":2000}]');
  RAISE EXCEPTION 'TEST FAILED: invalid participant accepted';
EXCEPTION WHEN sqlstate '22023' THEN NULL; END $$;

-- 2. Induced failure DURING split insert (negative amount bypasses nothing; use a
--    non-existent person to trip the FK after the delete) must roll back.
DO $$ BEGIN
  PERFORM public.update_expense_with_splits('00000000-0000-0000-0000-0000000000d1',
    '{"title":"Changed","total_minor":2000,"group_id":""}',
    true, '[{"person_id":"00000000-0000-0000-0000-0000000000ff","amount_minor":2000}]');
  RAISE EXCEPTION 'TEST FAILED: FK violation accepted';
EXCEPTION WHEN foreign_key_violation THEN NULL; END $$;

DO $$ BEGIN
  IF (SELECT title || total_minor || coalesce(group_id::text,'-') FROM public.expenses WHERE id = '00000000-0000-0000-0000-0000000000d1')
     <> 'Original1000' || '00000000-0000-0000-0000-0000000000c1' THEN
    RAISE EXCEPTION 'TEST FAILED: expense fields changed after failure';
  END IF;
  IF (SELECT count(*) || ':' || sum(amount_minor) FROM public.expense_splits WHERE expense_id = '00000000-0000-0000-0000-0000000000d1') <> '2:1000' THEN
    RAISE EXCEPTION 'TEST FAILED: splits changed after failure';
  END IF;
END $$;

-- 3. Unauthorized caller leaves everything unchanged.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
DO $$ BEGIN
  PERFORM public.update_expense_with_splits('00000000-0000-0000-0000-0000000000d1', '{"title":"Hijack"}', false, '[]');
  RAISE EXCEPTION 'TEST FAILED: unauthorized edit accepted';
EXCEPTION WHEN sqlstate 'P0002' OR sqlstate '42501' THEN NULL; END $$;

-- 4. Successful edit changes fields and splits together.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT public.update_expense_with_splits('00000000-0000-0000-0000-0000000000d1',
  '{"title":"New","total_minor":900}', true,
  '[{"person_id":"00000000-0000-0000-0000-0000000000b1","amount_minor":300},{"person_id":"00000000-0000-0000-0000-0000000000b2","amount_minor":600}]');
DO $$ BEGIN
  IF (SELECT title || total_minor FROM public.expenses WHERE id = '00000000-0000-0000-0000-0000000000d1') <> 'New900'
     OR (SELECT count(*) || ':' || sum(amount_minor) FROM public.expense_splits WHERE expense_id = '00000000-0000-0000-0000-0000000000d1') <> '2:900' THEN
    RAISE EXCEPTION 'TEST FAILED: successful edit not applied atomically';
  END IF;
  RAISE NOTICE 'update_expense_with_splits: ALL CHECKS PASSED';
END $$;

ROLLBACK;

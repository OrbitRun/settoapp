-- Real-database test: editing an expense that involves a FORMER group member.
-- The removed member keeps their group_members row (removed_at set). Editing an
-- unrelated field, or re-saving the same splits, must keep that person and
-- their share. Runs inside BEGIN ... ROLLBACK on an isolated test DB only.
-- Run: psql -v ON_ERROR_STOP=1 -f supabase/tests/update_expense_historical_participant.sql
BEGIN;
SET LOCAL client_min_messages = notice;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000001a1', 'hist-test@example.invalid');
INSERT INTO public.people (id, owner_user_id, name, is_self, status)
VALUES ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001a1', 'Owner', true, 'active'),
       ('00000000-0000-0000-0000-0000000001b2', '00000000-0000-0000-0000-0000000001a1', 'Former', false, 'active');
INSERT INTO public.groups (id, owner_user_id, name, default_split_type, currency)
VALUES ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001a1', 'H', 'equal', 'DKK');
INSERT INTO public.group_members (owner_user_id, group_id, person_id, role, removed_at)
VALUES ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001b1', 'owner', NULL),
       ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001b2', 'member', now());
-- Expense PAID BY the former member, split with the owner.
INSERT INTO public.expenses (id, owner_user_id, group_id, paid_by_person_id, title, currency, total_minor, source_type, exchange_rate, exchange_rate_source)
VALUES ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001c1',
        '00000000-0000-0000-0000-0000000001b2', 'Dinner', 'DKK', 1000, 'manual', 1, 'none');
INSERT INTO public.expense_splits (owner_user_id, expense_id, person_id, amount_minor)
VALUES ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001b1', 400),
       ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001b2', 600);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$ BEGIN
  IF current_user <> 'authenticated' OR (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'TEST FAILED: not running as plain authenticated role';
  END IF;
END $$;

-- 1. Title-only edit (app sends splits = null, payer unchanged in patch as the form does).
SELECT public.update_expense_with_splits('00000000-0000-0000-0000-0000000001d1',
  '{"title":"Dinner (edited)","paid_by_person_id":"00000000-0000-0000-0000-0000000001b2"}', false, '[]');
DO $$ BEGIN
  IF (SELECT title || '|' || paid_by_person_id FROM public.expenses WHERE id = '00000000-0000-0000-0000-0000000001d1')
     <> 'Dinner (edited)|00000000-0000-0000-0000-0000000001b2'
     OR (SELECT string_agg(person_id || ':' || amount_minor, ',' ORDER BY person_id) FROM public.expense_splits WHERE expense_id = '00000000-0000-0000-0000-0000000001d1')
     <> '00000000-0000-0000-0000-0000000001b1:400,00000000-0000-0000-0000-0000000001b2:600' THEN
    RAISE EXCEPTION 'TEST FAILED: title edit altered former member payer/share';
  END IF;
END $$;

-- 2. Re-saving the same splits (including the former member) is accepted unchanged.
SELECT public.update_expense_with_splits('00000000-0000-0000-0000-0000000001d1',
  '{"title":"Dinner (again)"}', true,
  '[{"person_id":"00000000-0000-0000-0000-0000000001b1","amount_minor":400},{"person_id":"00000000-0000-0000-0000-0000000001b2","amount_minor":600}]');
DO $$ BEGIN
  IF (SELECT string_agg(person_id || ':' || amount_minor, ',' ORDER BY person_id) FROM public.expense_splits WHERE expense_id = '00000000-0000-0000-0000-0000000001d1')
     <> '00000000-0000-0000-0000-0000000001b1:400,00000000-0000-0000-0000-0000000001b2:600' THEN
    RAISE EXCEPTION 'TEST FAILED: re-saved splits dropped/altered former member';
  END IF;
  RAISE NOTICE 'historical participant: ALL CHECKS PASSED';
END $$;

ROLLBACK;

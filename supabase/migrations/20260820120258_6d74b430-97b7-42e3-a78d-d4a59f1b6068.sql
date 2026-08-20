ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_personal_requires_owner
  CHECK (group_id IS NOT NULL OR owner_user_id IS NOT NULL)
  NOT VALID;

ALTER TABLE public.expenses
  VALIDATE CONSTRAINT expenses_personal_requires_owner;
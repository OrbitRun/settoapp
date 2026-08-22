ALTER TABLE public.people ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.people DROP CONSTRAINT people_owner_user_id_fkey;
ALTER TABLE public.people ADD CONSTRAINT people_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.groups ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.groups DROP CONSTRAINT groups_owner_user_id_fkey;
ALTER TABLE public.groups ADD CONSTRAINT groups_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.group_members ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.group_members DROP CONSTRAINT group_members_owner_user_id_fkey;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.group_invitations ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.group_invitations DROP CONSTRAINT group_invitations_owner_user_id_fkey;
ALTER TABLE public.group_invitations ADD CONSTRAINT group_invitations_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expenses ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.expenses DROP CONSTRAINT expenses_owner_user_id_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expense_items ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.expense_items DROP CONSTRAINT expense_items_owner_user_id_fkey;
ALTER TABLE public.expense_items ADD CONSTRAINT expense_items_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expense_splits ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.expense_splits DROP CONSTRAINT expense_splits_owner_user_id_fkey;
ALTER TABLE public.expense_splits ADD CONSTRAINT expense_splits_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.item_splits ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.item_splits DROP CONSTRAINT item_splits_owner_user_id_fkey;
ALTER TABLE public.item_splits ADD CONSTRAINT item_splits_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.settlements ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.settlements DROP CONSTRAINT settlements_owner_user_id_fkey;
ALTER TABLE public.settlements ADD CONSTRAINT settlements_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.activity ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.activity DROP CONSTRAINT activity_owner_user_id_fkey;
ALTER TABLE public.activity ADD CONSTRAINT activity_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
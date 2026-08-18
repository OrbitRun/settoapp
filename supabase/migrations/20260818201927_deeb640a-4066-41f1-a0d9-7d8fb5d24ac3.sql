ALTER TABLE public.group_invitations ADD COLUMN IF NOT EXISTS sent_at timestamptz;
UPDATE public.group_invitations SET sent_at = created_at WHERE sent_at IS NULL AND person_id IS NOT NULL;
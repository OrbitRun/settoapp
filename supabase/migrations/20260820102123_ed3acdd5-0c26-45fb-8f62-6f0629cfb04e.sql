ALTER TABLE public.people
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','former')),
  ADD COLUMN unlinked_at timestamp with time zone NULL;

COMMENT ON COLUMN public.people.status IS 'Lifecycle state: active (normal/claimed or placeholder) or former (account deleted, historical identity preserved).';
COMMENT ON COLUMN public.people.unlinked_at IS 'When the authenticated profile was unlinked from this historical person.';
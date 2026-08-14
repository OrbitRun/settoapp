-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'PARI',
  avatar_url text,
  language text NOT NULL DEFAULT 'da',
  currency text NOT NULL DEFAULT 'DKK',
  appearance text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- PEOPLE
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  avatar_url text,
  is_self boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own people" ON public.people FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- GROUPS
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  default_split_type text NOT NULL DEFAULT 'equal',
  currency text NOT NULL DEFAULT 'DKK',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own groups" ON public.groups FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- GROUP MEMBERS
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  default_weight numeric,
  default_percentage numeric,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own group members" ON public.group_members FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- EXPENSES
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  paid_by_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  title text NOT NULL,
  merchant text,
  expense_date timestamptz NOT NULL DEFAULT now(),
  currency text NOT NULL DEFAULT 'DKK',
  total_minor bigint NOT NULL DEFAULT 0,
  source_type text NOT NULL DEFAULT 'manual',
  receipt_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expenses" ON public.expenses FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- EXPENSE ITEMS
CREATE TABLE public.expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  category text,
  is_shared boolean NOT NULL DEFAULT true,
  confidence numeric,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_items TO authenticated;
GRANT ALL ON public.expense_items TO service_role;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expense items" ON public.expense_items FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- EXPENSE SPLITS
CREATE TABLE public.expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL DEFAULT 0,
  percentage numeric,
  shares numeric
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_splits TO authenticated;
GRANT ALL ON public.expense_splits TO service_role;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expense splits" ON public.expense_splits FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- ITEM SPLITS
CREATE TABLE public.item_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  expense_item_id uuid NOT NULL REFERENCES public.expense_items(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL DEFAULT 0,
  percentage numeric,
  shares numeric
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_splits TO authenticated;
GRANT ALL ON public.item_splits TO service_role;
ALTER TABLE public.item_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own item splits" ON public.item_splits FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- SETTLEMENTS
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  to_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'DKK',
  status text NOT NULL DEFAULT 'settled',
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settlements" ON public.settlements FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- ACTIVITY
CREATE TABLE public.activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  actor_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity TO authenticated;
GRANT ALL ON public.activity TO service_role;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity" ON public.activity FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX ON public.expenses (owner_user_id, expense_date DESC);
CREATE INDEX ON public.expense_splits (expense_id);
CREATE INDEX ON public.expense_items (expense_id);
CREATE INDEX ON public.group_members (group_id);
CREATE INDEX ON public.activity (owner_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.pari_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER expenses_touch BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.pari_touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.pari_touch_updated_at();

CREATE POLICY "own receipt read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own receipt write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own receipt delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.pari_seed_expense(
  _user_id uuid, _group uuid, _payer uuid, _title text, _merchant text,
  _total bigint, _date timestamptz, _people uuid[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e_id uuid; n int; base bigint; rem int; i int;
BEGIN
  INSERT INTO public.expenses (owner_user_id, group_id, paid_by_person_id, title, merchant, total_minor, expense_date, created_at, updated_at)
  VALUES (_user_id, _group, _payer, _title, _merchant, _total, _date, _date, _date) RETURNING id INTO e_id;

  n := array_length(_people, 1);
  base := _total / n;
  rem := _total - base * n;
  FOR i IN 1..n LOOP
    INSERT INTO public.expense_splits (owner_user_id, expense_id, person_id, amount_minor)
    VALUES (_user_id, e_id, _people[i], base + CASE WHEN i <= rem THEN 1 ELSE 0 END);
  END LOOP;

  INSERT INTO public.activity (owner_user_id, group_id, actor_person_id, activity_type, entity_type, entity_id, metadata, created_at)
  VALUES (_user_id, _group, _payer, 'expense_added', 'expense', e_id,
    jsonb_build_object('title', _title, 'amount_minor', _total), _date);
  RETURN e_id;
END; $$;

CREATE OR REPLACE FUNCTION public.pari_seed_starter_data(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p_self uuid; p_mads uuid; p_sofie uuid; p_emma uuid; p_anna uuid; p_jonas uuid; p_marie uuid;
  g_bo uuid; g_sh uuid; g_couple uuid; g_ski uuid; self_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.groups WHERE owner_user_id = _user_id) THEN RETURN; END IF;
  SELECT display_name INTO self_name FROM public.profiles WHERE id = _user_id;
  self_name := COALESCE(NULLIF(self_name, ''), 'Mig');

  INSERT INTO public.people (owner_user_id, name, is_self, linked_profile_id) VALUES (_user_id, self_name, true, _user_id) RETURNING id INTO p_self;
  INSERT INTO public.people (owner_user_id, name) VALUES (_user_id, 'Mads') RETURNING id INTO p_mads;
  INSERT INTO public.people (owner_user_id, name) VALUES (_user_id, 'Sofie') RETURNING id INTO p_sofie;
  INSERT INTO public.people (owner_user_id, name) VALUES (_user_id, 'Emma') RETURNING id INTO p_emma;
  INSERT INTO public.people (owner_user_id, name) VALUES (_user_id, 'Anna') RETURNING id INTO p_anna;
  INSERT INTO public.people (owner_user_id, name) VALUES (_user_id, 'Jonas') RETURNING id INTO p_jonas;
  INSERT INTO public.people (owner_user_id, name) VALUES (_user_id, 'Marie') RETURNING id INTO p_marie;

  INSERT INTO public.groups (owner_user_id, name, default_split_type) VALUES (_user_id, 'Bofællesskabet', 'equal') RETURNING id INTO g_bo;
  INSERT INTO public.groups (owner_user_id, name, default_split_type) VALUES (_user_id, 'Sommerhus', 'equal') RETURNING id INTO g_sh;
  INSERT INTO public.groups (owner_user_id, name, default_split_type) VALUES (_user_id, 'Anna & mig', 'percentage') RETURNING id INTO g_couple;
  INSERT INTO public.groups (owner_user_id, name, default_split_type) VALUES (_user_id, 'Skiferie', 'equal') RETURNING id INTO g_ski;

  INSERT INTO public.group_members (owner_user_id, group_id, person_id, role) VALUES
    (_user_id, g_bo, p_self, 'owner'), (_user_id, g_bo, p_mads, 'member'), (_user_id, g_bo, p_sofie, 'member'), (_user_id, g_bo, p_emma, 'member'),
    (_user_id, g_sh, p_self, 'owner'), (_user_id, g_sh, p_mads, 'member'), (_user_id, g_sh, p_sofie, 'member'), (_user_id, g_sh, p_emma, 'member'), (_user_id, g_sh, p_jonas, 'member'), (_user_id, g_sh, p_marie, 'member'),
    (_user_id, g_ski, p_self, 'owner'), (_user_id, g_ski, p_mads, 'member'), (_user_id, g_ski, p_sofie, 'member');
  INSERT INTO public.group_members (owner_user_id, group_id, person_id, role, default_percentage) VALUES
    (_user_id, g_couple, p_self, 'owner', 60), (_user_id, g_couple, p_anna, 'member', 40);

  PERFORM public.pari_seed_expense(_user_id, g_bo, p_self, 'Netto', 'Netto', 48600, now() - interval '4 hours', ARRAY[p_self, p_mads, p_sofie, p_emma]);
  PERFORM public.pari_seed_expense(_user_id, g_bo, p_self, 'Internet', NULL, 34900, now() - interval '6 days', ARRAY[p_self, p_mads, p_sofie, p_emma]);
  PERFORM public.pari_seed_expense(_user_id, g_bo, p_mads, 'Fredagspizza', 'Pizzeria Roma', 79300, now() - interval '3 days', ARRAY[p_self, p_mads, p_sofie, p_emma]);
  PERFORM public.pari_seed_expense(_user_id, g_sh, p_self, 'Netto', 'Netto', 124800, now() - interval '9 days', ARRAY[p_self, p_mads, p_sofie, p_emma, p_jonas, p_marie]);
  PERFORM public.pari_seed_expense(_user_id, g_sh, p_mads, 'Shell', 'Shell', 61200, now() - interval '1 day', ARRAY[p_self, p_mads, p_sofie, p_emma, p_jonas, p_marie]);
  PERFORM public.pari_seed_expense(_user_id, g_sh, p_emma, 'Restaurant', 'Havnegrillen', 218000, now() - interval '7 days', ARRAY[p_self, p_mads, p_sofie, p_emma, p_jonas, p_marie]);
  PERFORM public.pari_seed_expense(_user_id, g_sh, p_marie, 'Rema 1000', 'Rema 1000', 97794, now() - interval '8 days', ARRAY[p_self, p_mads, p_sofie, p_emma, p_jonas, p_marie]);
  PERFORM public.pari_seed_expense(_user_id, g_couple, p_self, 'Elregning', NULL, 100000, now() - interval '12 days', ARRAY[p_self, p_anna]);
  PERFORM public.pari_seed_expense(_user_id, g_couple, p_anna, 'Storindkøb', 'Irma', 100000, now() - interval '4 days', ARRAY[p_self, p_anna]);
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1), 'PARI'))
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.pari_seed_starter_data(NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE POLICY "self linked people read"
  ON public.people
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (linked_profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_my_people_name(_name text)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_name := btrim(_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'name must not be empty';
  END IF;

  RETURN QUERY
  UPDATE public.people p
     SET name = v_name
   WHERE p.linked_profile_id = auth.uid()
     AND p.status = 'active'
  RETURNING p.id, p.name;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_people_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_people_name(text) TO authenticated;
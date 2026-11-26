-- Fix user_profiles RLS recursion
begin;

drop policy if exists "allow_write_user_profiles" on public.user_profiles;
drop policy if exists "allow_select_user_profiles" on public.user_profiles;

create policy "allow_select_user_profiles" on public.user_profiles
  for select using (true);

create policy "allow_insert_user_profiles" on public.user_profiles
  for insert with check (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (auth.uid() is not null and public.can_write_operations())
  );

create policy "allow_update_user_profiles" on public.user_profiles
  for update using (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or id = auth.uid()
    or (auth.uid() is not null and public.can_write_operations())
  );

create policy "allow_delete_user_profiles" on public.user_profiles
  for delete using (
    current_user in ('service_role', 'postgres')
    or (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
    or (coalesce(auth.jwt()->>'role', '') = 'service_role')
    or (auth.uid() is not null and public.can_write_operations())
  );

notify pgrst, 'reload schema';

commit;

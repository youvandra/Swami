-- People who already have an account join a workspace that invites them on their next login.
-- The workspace joined last is the one the app opens.
alter table public.members add column joined_at timestamptz not null default now();

create function public.accept_invites() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.members m set user_id = auth.uid(), status = 'active', joined_at = now()
  from auth.users u
  where u.id = auth.uid() and lower(m.email) = lower(u.email) and m.status = 'invited';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.accept_invites() from public;
grant execute on function public.accept_invites() to authenticated;

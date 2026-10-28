-- Swami schema. Every row belongs to a workspace; row-level security limits each user to the workspaces they
-- are an active member of. Owners manage members, Owners and Editors write, Viewers read.
-- Chat, project and artifact ids are client-generated text, so the app can write optimistically and import
-- what a browser already holds.

create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'promoter' check (role in ('promoter', 'buyer', 'agent', 'manager')),
  cities text[] not null default '{}',
  artists text[] not null default '{}',
  plan text not null default 'season' check (plan in ('single', 'season', 'group')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.members (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  email text not null,
  name text,
  role text not null check (role in ('Owner', 'Editor', 'Viewer')),
  status text not null default 'active' check (status in ('active', 'invited')),
  unique (workspace_id, email)
);

create table public.projects (
  id text primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null,
  kind text not null check (kind in ('show', 'tour')),
  tone text not null,
  headliner text not null default '',
  city text not null default '',
  date text not null default '',
  venue text not null default '',
  capacity int not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id text primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  project_id text references public.projects on delete set null,
  title text not null,
  mode text not null default 'auto',
  entities jsonb not null default '{}',
  created_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

create table public.messages (
  id text primary key,
  conversation_id text not null references public.conversations on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  steps jsonb,
  choices jsonb,
  created_at timestamptz not null default now()
);

create table public.artifacts (
  id text primary key,
  message_id text not null references public.messages on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  type text not null,
  position int not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.saved_artifacts (
  project_id text not null references public.projects on delete cascade,
  artifact_id text not null references public.artifacts on delete cascade,
  conversation_id text references public.conversations on delete set null,
  saved_at timestamptz not null default now(),
  primary key (project_id, artifact_id)
);

create table public.rosters (
  id text primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null,
  acts jsonb not null,
  created_at timestamptz not null default now()
);

create table public.usage_events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  kind text not null,
  qloo_calls int not null default 0,
  llm_input_tokens int not null default 0,
  llm_output_tokens int not null default 0,
  ms int,
  created_at timestamptz not null default now()
);

-- Server-side only: read and written with the service role, never exposed to users.
create table public.qloo_cache (
  key text primary key,
  body jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index on public.members (user_id);
create index on public.projects (workspace_id);
create index on public.conversations (workspace_id, updated_at desc);
create index on public.messages (conversation_id, created_at);
create index on public.artifacts (workspace_id);
create index on public.artifacts (message_id);
create index on public.rosters (workspace_id);
create index on public.usage_events (workspace_id, created_at);

-- ── membership helpers (security definer, so policies can read members without recursing into its policy) ──

create function public.member_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where workspace_id = ws and user_id = auth.uid() and status = 'active'
$$;

create function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.member_role(ws) is not null
$$;

create function public.can_write(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.member_role(ws) in ('Owner', 'Editor')
$$;

create function public.conversation_ws(c text) returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from public.conversations where id = c
$$;

create function public.project_ws(p text) returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from public.projects where id = p
$$;

-- ── row-level security ──

alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.artifacts enable row level security;
alter table public.saved_artifacts enable row level security;
alter table public.rosters enable row level security;
alter table public.usage_events enable row level security;
alter table public.qloo_cache enable row level security; -- no policies: service role only

create policy ws_read on public.workspaces for select using (public.is_member(id));
create policy ws_write on public.workspaces for update using (public.can_write(id)) with check (public.can_write(id));
create policy ws_delete on public.workspaces for delete using (public.member_role(id) = 'Owner');

create policy members_read on public.members for select using (public.is_member(workspace_id) or user_id = auth.uid());
create policy members_owner_insert on public.members for insert with check (public.member_role(workspace_id) = 'Owner');
create policy members_owner_update on public.members for update using (public.member_role(workspace_id) = 'Owner') with check (public.member_role(workspace_id) = 'Owner');
create policy members_owner_delete on public.members for delete using (public.member_role(workspace_id) = 'Owner');

do $$
declare t text;
begin
  foreach t in array array['projects', 'conversations', 'artifacts', 'rosters'] loop
    execute format('create policy %1$s_read on public.%1$s for select using (public.is_member(workspace_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.can_write(workspace_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update using (public.can_write(workspace_id)) with check (public.can_write(workspace_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (public.can_write(workspace_id))', t);
  end loop;
end $$;

create policy messages_read on public.messages for select using (public.is_member(public.conversation_ws(conversation_id)));
create policy messages_insert on public.messages for insert with check (public.can_write(public.conversation_ws(conversation_id)));
create policy messages_update on public.messages for update using (public.can_write(public.conversation_ws(conversation_id)));
create policy messages_delete on public.messages for delete using (public.can_write(public.conversation_ws(conversation_id)));

create policy saved_read on public.saved_artifacts for select using (public.is_member(public.project_ws(project_id)));
create policy saved_insert on public.saved_artifacts for insert with check (public.can_write(public.project_ws(project_id)));
create policy saved_delete on public.saved_artifacts for delete using (public.can_write(public.project_ws(project_id)));

-- any member's chat run counts against the workspace's daily limit
create policy usage_read on public.usage_events for select using (public.is_member(workspace_id));
create policy usage_insert on public.usage_events for insert with check (public.is_member(workspace_id));

-- ── first login: join the workspaces that invited this email, or get a workspace of one's own ──

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  update public.members set user_id = new.id, status = 'active' where lower(email) = lower(new.email) and status = 'invited';
  if not found then
    insert into public.workspaces (name) values (coalesce(split_part(new.email, '@', 1), 'My') || '''s workspace') returning id into ws;
    insert into public.members (workspace_id, user_id, email, name, role) values (ws, new.id, new.email, new.raw_user_meta_data ->> 'name', 'Owner');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.qloo_cache from authenticated, anon;

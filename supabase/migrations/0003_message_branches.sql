-- Undo and edited questions. A message the chat no longer shows is hidden, never deleted, so a result saved to a
-- project from it stays saved. An edited question keeps its other versions, and what answered each, in branches.
alter table public.messages add column hidden boolean not null default false;
alter table public.messages add column branches jsonb;

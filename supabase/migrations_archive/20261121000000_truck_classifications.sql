-- RouteX truck classifications: Freezer, Chilled, Dry
-- Replaces binary Refrigerated/Dry constraint with three-tier cargo classification
alter table public.trucks drop constraint if exists trucks_storage_capability_check;
alter table public.trucks add constraint trucks_storage_capability_check
  check (storage_capability in ('Freezer', 'Chilled', 'Dry', 'Refrigerated'));

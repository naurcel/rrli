-- RouteX delivery notes support
-- Adds operational notes/remarks column to public.deliveries
alter table public.deliveries add column if not exists notes text;

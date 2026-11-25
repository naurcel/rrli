-- Migration: Add dropoff_count to delivery_dropoffs table
-- Supports locations having multiple drop-offs / stops within a delivery trip

alter table public.delivery_dropoffs
  add column if not exists dropoff_count integer not null default 1;

comment on column public.delivery_dropoffs.dropoff_count is 'Number of stops or drop-offs performed at this store or destination location.';

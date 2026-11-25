-- ============================================================================
-- RouteX Baseline Fleet & Crew Seed
-- ============================================================================

begin;

-- Clients
insert into public.clients (id, name, is_active)
values
  ('10000000-0000-4000-8000-000000000001', 'Landers', true),
  ('10000000-0000-4000-8000-000000000002', 'Manila Comisario Central Inc. (MCCI)', true),
  ('10000000-0000-4000-8000-000000000003', 'Vanguard', true)
on conflict (id) do update set name = excluded.name, is_active = excluded.is_active;

-- Owned Trucks (6 trucks: 2 Freezer, 2 Chilled, 2 Dry)
insert into public.trucks (id, plate_number, truck_type, truck_temperature, storage_capability, ownership_type, rate_basis, provider, contact_person, is_active)
values
  ('20000000-0000-4000-8000-000000000001', 'NGS 4281', '6-Wheeler', '-18°C', 'Freezer', 'Owned', 'Redeemed Rate', null, null, true),
  ('20000000-0000-4000-8000-000000000002', 'DAA 7310', '6-Wheeler', '2°C–4°C', 'Chilled', 'Owned', 'Redeemed Rate', null, null, true),
  ('20000000-0000-4000-8000-000000000003', 'CBZ 1187', '10-Wheeler', null, 'Dry', 'Owned', 'Redeemed Rate', null, null, true),
  ('20000000-0000-4000-8000-000000000004', 'NBE 9042', '4-Wheeler', '2°C–4°C', 'Chilled', 'Owned', 'Redeemed Rate', null, null, true),
  ('20000000-0000-4000-8000-000000000005', 'ABX 2201', '4-Wheeler', '-18°C', 'Freezer', 'Owned', 'Redeemed Rate', null, null, true),
  ('20000000-0000-4000-8000-000000000006', 'XCY 6612', '4-Wheeler', null, 'Dry', 'Owned', 'Redeemed Rate', null, null, true)
on conflict (id) do update set
  plate_number = excluded.plate_number,
  truck_type = excluded.truck_type,
  truck_temperature = excluded.truck_temperature,
  storage_capability = excluded.storage_capability,
  ownership_type = excluded.ownership_type,
  rate_basis = excluded.rate_basis,
  is_active = excluded.is_active;

-- Subcontracted Trucks
insert into public.trucks (id, plate_number, truck_type, truck_temperature, storage_capability, ownership_type, rate_basis, provider, contact_person, is_active)
values
  ('21000000-0000-4000-8000-000000000001', 'KLM 4821', '4-Wheeler', null, 'Dry', 'Subcontracted', 'Trucker Rate', 'Northline Hauling', 'Adrian Cruz', true),
  ('21000000-0000-4000-8000-000000000002', 'PQR 7156', '6-Wheeler', '2°C–4°C', 'Chilled', 'Subcontracted', 'Trucker Rate', 'Silverroad Transport', 'Maribel Santos', true),
  ('21000000-0000-4000-8000-000000000003', 'TUV 3098', '10-Wheeler', null, 'Dry', 'Subcontracted', 'Trucker Rate', 'Primeway Logistics', 'Leo Navarro', true),
  ('21000000-0000-4000-8000-000000000004', 'BCD 8642', '4-Wheeler', '2°C–4°C', 'Chilled', 'Subcontracted', 'Trucker Rate', 'Eastgate Carriers', 'Ramon Lim', true),
  ('21000000-0000-4000-8000-000000000005', 'HJK 2207', '6-Wheeler', '-18°C', 'Freezer', 'Subcontracted', 'Trucker Rate', 'Roadcrest Freight', 'Angela Ramos', true),
  ('21000000-0000-4000-8000-000000000006', 'MNP 5934', '4-Wheeler', null, 'Dry', 'Subcontracted', 'Trucker Rate', 'Metrohaul Services', 'Joel Mendoza', true),
  ('21000000-0000-4000-8000-000000000007', 'STX 1479', '10-Wheeler', null, 'Dry', 'Subcontracted', 'Trucker Rate', 'Summit Cargo Lines', 'Carla Reyes', true),
  ('21000000-0000-4000-8000-000000000008', 'VWX 6385', '6-Wheeler', '2°C–4°C', 'Chilled', 'Subcontracted', 'Trucker Rate', 'Harborlink Transport', 'Dennis Flores', true),
  ('21000000-0000-4000-8000-000000000009', 'EFG 9013', '4-Wheeler', null, 'Dry', 'Subcontracted', 'Trucker Rate', 'Greenlane Hauling', 'Nina Garcia', true),
  ('21000000-0000-4000-8000-000000000010', 'JRS 3760', '6-Wheeler', '-18°C', 'Freezer', 'Subcontracted', 'Trucker Rate', 'Transpeak Logistics', 'Victor Aquino', true),
  ('21000000-0000-4000-8000-000000000011', 'XYZ 9102', '6-Wheeler', '2°C–4°C', 'Chilled', 'Subcontracted', 'Trucker Rate', 'Apex Cargo Movers', 'Danilo Ramos', true),
  ('21000000-0000-4000-8000-000000000012', 'NKL 3824', '4-Wheeler', null, 'Dry', 'Subcontracted', 'Trucker Rate', 'Southwind Freight', 'Grace Bautista', true),
  ('21000000-0000-4000-8000-000000000013', 'WXY 4819', '10-Wheeler', null, 'Dry', 'Subcontracted', 'Trucker Rate', 'Pacific Link Haulers', 'Ernesto Dizon', true),
  ('21000000-0000-4000-8000-000000000014', 'BVC 1928', '6-Wheeler', '-18°C', 'Freezer', 'Subcontracted', 'Trucker Rate', 'Polar Express Logistics', 'Theresa Ocampo', true),
  ('21000000-0000-4000-8000-000000000015', 'QWE 7341', '4-Wheeler', null, 'Dry', 'Subcontracted', 'Trucker Rate', 'Golden Route Transport', 'Fernando Tan', true)
on conflict (id) do update set
  plate_number = excluded.plate_number,
  truck_type = excluded.truck_type,
  truck_temperature = excluded.truck_temperature,
  storage_capability = excluded.storage_capability,
  ownership_type = excluded.ownership_type,
  rate_basis = excluded.rate_basis,
  provider = excluded.provider,
  contact_person = excluded.contact_person,
  is_active = excluded.is_active;

-- Employees (Drivers & Helpers)
insert into public.employees (id, employee_code, full_name, assignment_type, is_active)
values
  ('30000000-0000-4000-8000-000000000001', 'DRV-01', 'Mateo Dela Vega', 'Driver', true),
  ('30000000-0000-4000-8000-000000000002', 'DRV-02', 'Nico Serrano', 'Driver', true),
  ('30000000-0000-4000-8000-000000000003', 'DRV-03', 'Danilo Cruz', 'Driver', true),
  ('30000000-0000-4000-8000-000000000004', 'DRV-04', 'Arnel Pineda', 'Driver', true),
  ('30000000-0000-4000-8000-000000000005', 'HLP-01', 'Ira Santos', 'Helper', true),
  ('30000000-0000-4000-8000-000000000006', 'HLP-02', 'Paolo Reyes', 'Helper', true),
  ('30000000-0000-4000-8000-000000000007', 'HLP-03', 'Nestor Ramos', 'Helper', true),
  ('30000000-0000-4000-8000-000000000008', 'HLP-04', 'Joel Alcantara', 'Helper', true),
  ('30000000-0000-4000-8000-000000000009', 'HLP-05', 'Eduardo Gomez', 'Helper', true),
  ('30000000-0000-4000-8000-000000000010', 'HLP-06', 'Roderick Tan', 'Helper', true)
on conflict (id) do update set
  employee_code = excluded.employee_code,
  full_name = excluded.full_name,
  assignment_type = excluded.assignment_type,
  is_active = excluded.is_active;

commit;

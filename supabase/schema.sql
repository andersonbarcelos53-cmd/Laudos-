create table if not exists public.certificates (
  id serial primary key,
  sap_code text not null,
  production_date text not null,
  product_name text,
  file_name text not null,
  file_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists certificates_sap_code_idx
  on public.certificates (sap_code);

create table if not exists public.pallet_quantities (
  id serial primary key,
  sap_code text not null unique,
  product_name text,
  pieces_per_pallet integer not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.history (
  id serial primary key,
  certificate_id integer not null,
  sap_code text not null,
  product_name text,
  production_date text not null,
  invoice_number text not null,
  pallets integer not null,
  pieces integer not null,
  generated_at timestamptz not null default now(),
  user_name text not null,
  generated_file_path text not null
);

create index if not exists history_generated_at_idx
  on public.history (generated_at desc);

create index if not exists history_sap_code_idx
  on public.history (sap_code);

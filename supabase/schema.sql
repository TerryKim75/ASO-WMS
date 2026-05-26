-- ASO System WMS Database Schema
-- Run this in your Supabase SQL Editor

-- Items master list
create table if not exists items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null check (category in ('모듈프레임', '파트', '마감재', '팔레트', '공구')),
  unit text not null default 'EA',
  description text,
  created_at timestamptz default now()
);

-- Projects
create table if not exists wms_projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  client text,
  start_date date,
  end_date date,
  status text default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

-- All inventory movements
create table if not exists inventory_transactions (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references items(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('입고', '출고', '반입', '손실')),
  quantity integer not null check (quantity > 0),
  project_id uuid references wms_projects(id) on delete set null,
  transaction_date date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

-- Disable Row Level Security (for internal tool usage)
alter table items disable row level security;
alter table wms_projects disable row level security;
alter table inventory_transactions disable row level security;

-- Optional: Create indexes for performance
create index if not exists idx_transactions_item_id on inventory_transactions(item_id);
create index if not exists idx_transactions_project_id on inventory_transactions(project_id);
create index if not exists idx_transactions_date on inventory_transactions(transaction_date);
create index if not exists idx_transactions_type on inventory_transactions(transaction_type);
create index if not exists idx_items_category on items(category);

-- Current stock formula per item:
-- SUM(quantity WHERE type='입고') - SUM(quantity WHERE type='출고') + SUM(quantity WHERE type='반입') - SUM(quantity WHERE type='손실')

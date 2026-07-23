-- ==========================================
-- CATEGORÍAS (torta, gelatina, otro... escalable)
-- ==========================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- ==========================================
-- PRODUCTOS
-- ==========================================
create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  name text not null,
  default_price numeric(10,2),
  active boolean default true,
  created_at timestamptz default now()
);

-- ==========================================
-- VARIANTES DE PRECIO (Entero, Medio, etc.)
-- ==========================================
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  name text not null,                  -- 'Entero', 'Medio', 'Porcion'
  price numeric(10,2) not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- ==========================================
-- CALENDARIO DE PRODUCCIÓN
-- ==========================================
create table product_schedule (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  active boolean default true
);

-- ==========================================
-- COMPRAS / GASTOS
-- ==========================================
create table purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_date date not null default current_date,
  item text not null,
  quantity numeric(10,2),
  unit text,
  unit_cost numeric(10,2),
  total_cost numeric(10,2),
  category_id uuid references categories(id),
  notes text,
  created_at timestamptz default now()
);

-- ==========================================
-- PRODUCCIÓN
-- ==========================================
create table production_batches (
  id uuid primary key default gen_random_uuid(),
  production_date date not null default current_date,
  product_id uuid references products(id),
  variant_id uuid references product_variants(id),
  size text check (size in ('grande', 'pequena')),
  quantity_produced int not null,
  portions_cut int,
  notes text,
  created_at timestamptz default now()
);

-- ==========================================
-- VENTAS
-- ==========================================
create table sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  product_id uuid references products(id),
  variant_id uuid references product_variants(id),
  quantity int not null default 1,
  unit_price numeric(10,2) not null,
  total_amount numeric(10,2) generated always as (quantity * unit_price) stored,
  payment_method text not null check (payment_method in ('yape', 'efectivo')),
  created_at timestamptz default now()
);

-- ==========================================
-- VISTAS DE REPORTES
-- ==========================================

create view daily_sales_summary as
select
  sale_date,
  sum(total_amount) filter (where payment_method = 'yape') as total_yape,
  sum(total_amount) filter (where payment_method = 'efectivo') as total_efectivo,
  sum(total_amount) as total_dia
from sales
group by sale_date
order by sale_date desc;

create view daily_expense_summary as
select purchase_date, sum(total_cost) as total_gastado
from purchases
group by purchase_date
order by purchase_date desc;

create view weekly_production_summary as
select
  date_trunc('week', production_date)::date as week_start,
  product_id,
  sum(quantity_produced) as total_producido
from production_batches
group by week_start, product_id
order by week_start desc;

create view weekly_sales_summary as
select
  date_trunc('week', sale_date)::date as week_start,
  product_id,
  sum(quantity) as total_vendido,
  sum(total_amount) as ingreso_total
from sales
group by week_start, product_id
order by week_start desc;

create view weekly_profit_summary as
select
  date_trunc('week', s.week_start)::date as week_start,
  s.ingreso_total,
  e.total_gastado,
  (s.ingreso_total - coalesce(e.total_gastado, 0)) as ganancia
from (
  select date_trunc('week', sale_date)::date as week_start, sum(total_amount) as ingreso_total
  from sales group by week_start
) s
left join (
  select date_trunc('week', purchase_date)::date as week_start, sum(total_cost) as total_gastado
  from purchases group by week_start
) e on s.week_start = e.week_start
order by s.week_start desc;

create view weekly_sales_by_variant as
select
  date_trunc('week', s.sale_date)::date as week_start,
  s.product_id,
  p.name as product_name,
  s.variant_id,
  v.name as variant_name,
  sum(s.quantity) as total_vendido,
  sum(s.total_amount) as ingreso_total
from sales s
join products p on p.id = s.product_id
left join product_variants v on v.id = s.variant_id
group by week_start, s.product_id, p.name, s.variant_id, v.name
order by week_start desc, product_name, variant_name;

create view monthly_sales_summary as
select
  date_trunc('month', sale_date)::date as month_start,
  sum(total_amount) filter (where payment_method = 'yape') as total_yape,
  sum(total_amount) filter (where payment_method = 'efectivo') as total_efectivo,
  sum(total_amount) as total_vendido
from sales
group by month_start
order by month_start desc;

create view monthly_expense_summary as
select
  date_trunc('month', purchase_date)::date as month_start,
  sum(total_cost) as total_gastado
from purchases
group by month_start
order by month_start desc;

create view monthly_production_summary as
select
  date_trunc('month', production_date)::date as month_start,
  product_id,
  sum(quantity_produced) as total_producido
from production_batches
group by month_start, product_id
order by month_start desc;

create view product_stock as
with produced_whole as (
  select product_id, size, sum(quantity_produced) as unidades_producidas
  from production_batches
  where portions_cut is null
  group by product_id, size
),
produced_portions as (
  select product_id, size, sum(portions_cut) as porciones_producidas
  from production_batches
  where portions_cut is not null
  group by product_id, size
),
sold_whole as (
  select s.product_id, s.variant_id, sum(s.quantity) as unidades_vendidas
  from sales s
  join product_variants v on v.id = s.variant_id
  where v.name not ilike '%porci%'
  group by s.product_id, s.variant_id
),
sold_portions as (
  select s.product_id, sum(s.quantity) as porciones_vendidas
  from sales s
  join product_variants v on v.id = s.variant_id
  where v.name ilike '%porci%'
  group by s.product_id
)
select
  p.id as product_id,
  p.name as product_name,
  pw.size,
  coalesce(pw.unidades_producidas, 0) as unidades_producidas,
  coalesce(sw.total_vendidas, 0) as unidades_vendidas,
  coalesce(pw.unidades_producidas, 0) - coalesce(sw.total_vendidas, 0) as stock_unidades_enteras,
  coalesce(pp.porciones_producidas, 0) - coalesce(sp.porciones_vendidas, 0) as stock_porciones
from products p
left join produced_whole pw on pw.product_id = p.id
left join produced_portions pp on pp.product_id = p.id and pp.size = pw.size
left join (
  select product_id, sum(unidades_vendidas) as total_vendidas
  from sold_whole
  group by product_id
) sw on sw.product_id = p.id
left join sold_portions sp on sp.product_id = p.id
where p.active = true;

-- ==========================================
-- RLS (Row Level Security) - auth required
-- ==========================================
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_schedule enable row level security;
alter table purchases enable row level security;
alter table production_batches enable row level security;
alter table sales enable row level security;

create policy "Authenticated users can do everything" on categories for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on products for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on product_variants for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on product_schedule for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on purchases for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on production_batches for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything" on sales for all using (auth.role() = 'authenticated');

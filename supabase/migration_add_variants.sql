-- MIGRATION: Variantes + tamano + produccion por variante + stock
-- Ejecutar esto si ya tienes datos en las tablas

-- 1. Crear tabla de variantes (si no existe)
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- 2. Agregar size a product_variants (nullable, no rompe datos existentes)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'product_variants' and column_name = 'size'
  ) then
    alter table product_variants add column size text check (size in ('grande', 'pequena', null));
  end if;
end $$;

-- 3. Agregar variant_id a sales (nullable)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'sales' and column_name = 'variant_id'
  ) then
    alter table sales add column variant_id uuid references product_variants(id);
  end if;
end $$;

-- 4. Agregar variant_id y portions_cut a production_batches
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'production_batches' and column_name = 'variant_id'
  ) then
    alter table production_batches add column variant_id uuid references product_variants(id);
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'production_batches' and column_name = 'portions_cut'
  ) then
    alter table production_batches add column portions_cut int;
  end if;
end $$;

-- 5. Migrar productos existentes: crear variante "Entero" con default_price
insert into product_variants (product_id, name, price)
select id, 'Entero', default_price
from products
where default_price is not null
  and not exists (
    select 1 from product_variants where product_id = products.id
  );

-- 6. RLS
alter table product_variants enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Authenticated users can do everything' and tablename = 'product_variants'
  ) then
    create policy "Authenticated users can do everything" on product_variants
      for all using (auth.role() = 'authenticated');
  end if;
end $$;

-- 7. Vista de ventas por variante semanal
create or replace view weekly_sales_by_variant as
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

-- 8. Vista de stock por variante (no asume nada, suma lo registrado)
create or replace view product_stock as
with produced_whole as (
  select product_id, variant_id, sum(quantity_produced) as unidades_producidas
  from production_batches
  where portions_cut is null
  group by product_id, variant_id
),
produced_portions as (
  select product_id, variant_id, sum(portions_cut) as porciones_producidas
  from production_batches
  where portions_cut is not null
  group by product_id, variant_id
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
  v.id as variant_id,
  v.name as variant_name,
  v.size,
  coalesce(pw.unidades_producidas, 0) - coalesce(sw.unidades_vendidas, 0) as stock_unidades_enteras,
  coalesce(pp.porciones_producidas, 0) - coalesce(sp.porciones_vendidas, 0) as stock_porciones
from products p
join product_variants v on v.product_id = p.id
left join produced_whole pw on pw.product_id = p.id and pw.variant_id = v.id
left join produced_portions pp on pp.product_id = p.id and pp.variant_id = v.id
left join sold_whole sw on sw.product_id = p.id and sw.variant_id = v.id
left join sold_portions sp on sp.product_id = p.id
where p.active = true and v.active = true;

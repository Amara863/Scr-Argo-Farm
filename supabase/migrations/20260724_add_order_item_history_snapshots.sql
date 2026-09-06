alter table public.order_items
  add column if not exists product_name text null,
  add column if not exists selected_unit text null;

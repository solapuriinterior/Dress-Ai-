-- Shop-owned catalogue and private, bounded AI job metadata.
-- No customer image or generated result is stored in these tables or public storage.
create table public.dress_ai_shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  currency text not null default 'INR' check (currency in ('INR','USD','EUR','GBP','AED')),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
alter table public.dress_ai_shops enable row level security;
revoke all on public.dress_ai_shops from PUBLIC, anon, authenticated;
grant select on public.dress_ai_shops to anon, authenticated;
grant insert, update on public.dress_ai_shops to authenticated;
grant all on public.dress_ai_shops to service_role;
create policy shops_read on public.dress_ai_shops for select to anon, authenticated using (true);
create policy shops_insert on public.dress_ai_shops for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy shops_update on public.dress_ai_shops for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

alter table public.dress_ai_products
  add column shop_id uuid,
  add column currency text not null default 'INR' check (currency in ('INR','USD','EUR','GBP','AED')),
  add column active boolean not null default true,
  add constraint products_shop_owner_fk foreign key (shop_id, owner_id)
    references public.dress_ai_shops(id, owner_id) on delete cascade,
  add constraint products_own_storage check (storage_path like owner_id::text || '/%');
create index if not exists dress_ai_products_owner_idx on public.dress_ai_products(owner_id);
create index dress_ai_products_shop_created_idx on public.dress_ai_products(shop_id, created_at desc);
drop policy catalogue_read on public.dress_ai_products;
create policy catalogue_read on public.dress_ai_products for select to anon, authenticated
  using ((active and shop_id is not null) or owner_id = (select auth.uid()));
-- Existing ownership INSERT/UPDATE/DELETE policies remain in effect.
revoke all on public.dress_ai_products from PUBLIC, anon, authenticated;
grant select on public.dress_ai_products to anon, authenticated;
grant insert, update, delete on public.dress_ai_products to authenticated;
grant all on public.dress_ai_products to service_role;

create table public.dress_ai_jobs (
  id uuid primary key,
  shop_id uuid not null references public.dress_ai_shops(id) on delete cascade,
  product_id uuid references public.dress_ai_products(id) on delete set null,
  provider_id text,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'starting' check (status in ('starting','processing','completed','failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 minutes'
);
create index dress_ai_jobs_shop_created_idx on public.dress_ai_jobs(shop_id, created_at desc);
create index dress_ai_jobs_ip_created_idx on public.dress_ai_jobs(ip_hash, created_at desc);
create index dress_ai_jobs_created_idx on public.dress_ai_jobs(created_at);
create index dress_ai_jobs_product_idx on public.dress_ai_jobs(product_id);
alter table public.dress_ai_jobs enable row level security;
revoke all on public.dress_ai_jobs from PUBLIC, anon, authenticated;
grant select (id,shop_id,product_id,status,created_at,expires_at) on public.dress_ai_jobs to authenticated;
grant all on public.dress_ai_jobs to service_role;
create policy jobs_owner_read on public.dress_ai_jobs for select to authenticated
  using (shop_id in (select id from public.dress_ai_shops where owner_id = (select auth.uid())));

create function public.dress_ai_reserve_job(
  p_id uuid, p_shop_id uuid, p_product_id uuid, p_token_hash text, p_ip_hash text,
  p_shop_limit integer, p_ip_limit integer, p_global_limit integer
) returns text language plpgsql security invoker set search_path = '' as $$
declare today timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_shop_limit not between 1 and 1000 or p_ip_limit not between 1 and 100
     or p_global_limit not between 1 and 10000 then
    raise exception 'Invalid preview limits';
  end if;
  -- Serialize budget reservations: concurrent/serverless requests cannot overspend the daily cap.
  perform pg_advisory_xact_lock(hashtextextended('dress-ai-global-budget', 0));
  if not exists (select 1 from public.dress_ai_products
    where id = p_product_id and shop_id = p_shop_id and active) then
    return 'unavailable';
  end if;
  if (select count(*) from public.dress_ai_jobs where created_at >= today) >= p_global_limit
     or (select count(*) from public.dress_ai_jobs where shop_id = p_shop_id and created_at >= today) >= p_shop_limit
     or (select count(*) from public.dress_ai_jobs where ip_hash = p_ip_hash and created_at >= today) >= p_ip_limit then
    return 'limit';
  end if;
  if (select count(*) from public.dress_ai_jobs where status in ('starting','processing')
      and created_at > now() - interval '5 minutes') >= 6 then return 'busy'; end if;
  insert into public.dress_ai_jobs(id,shop_id,product_id,token_hash,ip_hash)
    values (p_id,p_shop_id,p_product_id,p_token_hash,p_ip_hash);
  return 'ok';
end;
$$;
revoke all on function public.dress_ai_reserve_job(uuid,uuid,uuid,text,text,integer,integer,integer)
  from PUBLIC, anon, authenticated;
grant execute on function public.dress_ai_reserve_job(uuid,uuid,uuid,text,text,integer,integer,integer)
  to service_role;

update storage.buckets set file_size_limit = 3000000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'dress-ai-catalogue';
create policy dress_ai_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'dress-ai-catalogue' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'dress-ai-catalogue' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The original unowned demo table must not accept unauthenticated writes.
drop policy "Allow public insert" on public.dresses;
revoke insert, update, delete on public.dresses from PUBLIC, anon, authenticated;
notify pgrst, 'reload schema';

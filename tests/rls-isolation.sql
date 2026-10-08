begin;
do $$
declare
  owner_a uuid; owner_b uuid; shop_a uuid := gen_random_uuid(); shop_b uuid := gen_random_uuid();
  product_a uuid := gen_random_uuid(); product_b uuid := gen_random_uuid();
  job_a uuid := gen_random_uuid(); touched integer; result text;
begin
  select id into owner_a from auth.users order by created_at,id limit 1;
  select id into owner_b from auth.users where id <> owner_a order by created_at,id limit 1;
  if owner_a is null or owner_b is null then raise exception 'Two existing accounts are required for isolation verification'; end if;
  insert into public.dress_ai_shops(id,owner_id,name,slug)
    values (shop_a,owner_a,'QA Shop A','qa-' || shop_a), (shop_b,owner_b,'QA Shop B','qa-' || shop_b);
  insert into public.dress_ai_products(id,owner_id,shop_id,name,price,image,storage_path,category,active)
    values (product_a,owner_a,shop_a,'QA A',100,'https://example.invalid/a.jpg',owner_a || '/qa-a.jpg','upper_body',true),
           (product_b,owner_b,shop_b,'QA B',200,'https://example.invalid/b.jpg',owner_b || '/qa-b.jpg','upper_body',false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',owner_a,'role','authenticated')::text, true);
  set local role authenticated;
  update public.dress_ai_products set name='QA cross-shop write' where id=product_b;
  get diagnostics touched = row_count;
  if touched <> 0 then raise exception 'Cross-shop update allowed'; end if;
  if exists (select 1 from public.dress_ai_products where id=product_b) then
    raise exception 'Hidden product visible across shops';
  end if;
  begin
    insert into public.dress_ai_products(owner_id,shop_id,name,price,image,storage_path,category)
      values(owner_b,shop_b,'QA unauthorized',1,'https://example.invalid/no.jpg',owner_b || '/qa-no.jpg','upper_body');
    raise exception 'Cross-shop insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects(bucket_id,name) values('dress-ai-catalogue',owner_b || '/qa-no.jpg');
    raise exception 'Cross-shop storage upload allowed';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role service_role;
  select public.dress_ai_reserve_job(job_a,shop_a,product_a,repeat('a',64),repeat('b',64),1,100,10000) into result;
  if result <> 'ok' then raise exception 'First budget reservation failed: %',result; end if;
  select public.dress_ai_reserve_job(gen_random_uuid(),shop_a,product_a,repeat('a',64),repeat('b',64),1,100,10000) into result;
  if result <> 'limit' then raise exception 'Daily shop limit was bypassed'; end if;
  reset role;
  set local role anon;
  if exists (select 1 from public.dress_ai_products where id=product_b) then
    raise exception 'Anonymous hidden product access allowed';
  end if;
  begin
    insert into public.dresses(name,image) values('QA bad','https://example.invalid/no.jpg');
    raise exception 'Anonymous legacy catalogue insert allowed';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
select 'PASS: cross-shop edits/uploads blocked, hidden products private, budgets enforced, anonymous legacy writes blocked' as result;
rollback;
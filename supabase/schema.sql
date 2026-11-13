-- =============================================================
--  와이드가드 매칭 플랫폼 - Supabase 스키마
--  Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- =============================================================

-- ---------- 회원 프로필 ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer', 'vendor', 'admin')),
  created_at timestamptz not null default now()
);

-- 가입 시 프로필 자동 생성 (admin 은 가입으로 만들 수 없음)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'phone',
    case when new.raw_user_meta_data->>'role' = 'vendor' then 'vendor' else 'customer' end
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- 업체 ----------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  company text not null,
  ceo text not null,
  biz_no text not null,
  phone text not null,
  email text not null,
  address text,
  license_info text,
  categories text[] not null default '{}',
  regions text[] not null default '{}',
  intro text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rating numeric(2,1) not null default 0,
  review_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 견적 요청 ----------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null default '',
  category text not null,
  region text not null,
  title text not null,
  details text not null,
  service_date date not null,
  budget bigint,
  target_vendor_id uuid references public.vendors(id) on delete set null,
  photos text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'matched', 'paid', 'in_progress', 'completed', 'canceled')),
  selected_quote_id uuid,
  created_at timestamptz not null default now()
);

-- ---------- 견적 ----------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_company text not null default '',
  amount bigint not null check (amount > 0),
  message text not null default '',
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (request_id, vendor_id)
);

-- ---------- 상담 메시지 ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- ---------- 결제 ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  order_name text,
  request_id uuid not null references public.requests(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  vendor_id uuid not null references public.vendors(id),
  amount bigint not null,
  fee bigint not null,
  status text not null default 'ready' check (status in ('ready', 'paid', 'failed', 'refunded')),
  payment_key text,
  method text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- ---------- 설정 ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  fee_rate numeric(5,4) not null default 0.1
);
insert into public.settings (id, fee_rate) values (1, 0.1) on conflict (id) do nothing;

alter table public.requests add column if not exists photos text[] not null default '{}';  -- 기존 DB 업그레이드용
create index if not exists idx_requests_match on public.requests (status, category, region);
create index if not exists idx_quotes_request on public.quotes (request_id);
create index if not exists idx_messages_thread on public.messages (request_id, vendor_id, created_at);

-- =============================================================
--  RPC: 견적 선정 / 결제 생성 (금액은 서버에서 계산)
-- =============================================================
create or replace function public.accept_quote(p_quote_id uuid) returns public.quotes
language plpgsql security definer set search_path = public as $$
declare q quotes; r requests;
begin
  select * into q from quotes where id = p_quote_id;
  select * into r from requests where id = q.request_id;
  if r.customer_id <> auth.uid() then raise exception '권한이 없습니다.'; end if;
  if r.status <> 'open' then raise exception '이미 업체가 선정된 요청입니다.'; end if;
  update quotes set status = case when id = p_quote_id then 'accepted' else 'rejected' end where request_id = r.id;
  update requests set status = 'matched', selected_quote_id = p_quote_id where id = r.id;
  select * into q from quotes where id = p_quote_id;
  return q;
end $$;

create or replace function public.create_payment(p_quote_id uuid) returns public.payments
language plpgsql security definer set search_path = public as $$
declare q quotes; r requests; rate numeric; p payments;
begin
  select * into q from quotes where id = p_quote_id;
  select * into r from requests where id = q.request_id;
  if r.customer_id <> auth.uid() or q.status <> 'accepted' or r.status <> 'matched' then
    raise exception '결제할 수 없는 견적입니다.';
  end if;
  select fee_rate into rate from settings where id = 1;
  insert into payments (order_id, order_name, request_id, quote_id, customer_id, vendor_id, amount, fee)
  values (
    'WG' || to_char(now(), 'YYYYMMDDHH24MISS') || upper(substr(md5(random()::text), 1, 6)),
    left('[' || r.category || '] ' || r.title, 90),
    r.id, q.id, r.customer_id, q.vendor_id, q.amount, round(q.amount * rate)
  ) returning * into p;
  return p;
end $$;

-- =============================================================
--  Row Level Security
-- =============================================================
alter table public.profiles enable row level security;
alter table public.vendors  enable row level security;
alter table public.requests enable row level security;
alter table public.quotes   enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;

-- helper: 내 업체 id
create or replace function public.my_vendor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from vendors where owner_id = auth.uid() and status = 'approved';
$$;

-- helper: RLS 상호참조(무한 재귀) 방지용
create or replace function public.owns_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from requests where id = p_request_id and customer_id = auth.uid());
$$;
create or replace function public.vendor_quoted(p_request_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from quotes where request_id = p_request_id and vendor_id = public.my_vendor_id());
$$;
create or replace function public.request_is_open(p_request_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from requests where id = p_request_id and status = 'open');
$$;

-- profiles
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role in ('customer', 'vendor'));

-- vendors: 승인 업체는 누구나 조회, 본인/관리자는 전체
drop policy if exists "vendors read" on public.vendors;
create policy "vendors read" on public.vendors for select using (status = 'approved' or owner_id = auth.uid() or public.is_admin());
drop policy if exists "vendors insert" on public.vendors;
create policy "vendors insert" on public.vendors for insert with check (owner_id = auth.uid() and status = 'pending');
drop policy if exists "vendors update own" on public.vendors;
create policy "vendors update own" on public.vendors for update using (owner_id = auth.uid() or public.is_admin());

-- 업체가 스스로 status / rating 을 바꾸지 못하도록 트리거로 보호
create or replace function public.protect_vendor_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status := case when old.status = 'rejected' then 'pending' else old.status end;
    new.rating := old.rating; new.review_count := old.review_count; new.owner_id := old.owner_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_vendor on public.vendors;
create trigger trg_protect_vendor before update on public.vendors for each row execute function public.protect_vendor_fields();

-- requests
drop policy if exists "requests read" on public.requests;
create policy "requests read" on public.requests for select using (
  customer_id = auth.uid() or public.is_admin()
  or (public.my_vendor_id() is not null and (
        (status = 'open' and target_vendor_id is null)
        or target_vendor_id = public.my_vendor_id()
        or public.vendor_quoted(requests.id)
  ))
);
drop policy if exists "requests insert" on public.requests;
create policy "requests insert" on public.requests for insert with check (
  customer_id = auth.uid() and status = 'open'
  and not exists (select 1 from unnest(photos) p where p not like auth.uid()::text || '/%')  -- 본인이 올린 사진만 첨부
);
drop policy if exists "requests update" on public.requests;
create policy "requests update" on public.requests for update using (customer_id = auth.uid() or public.is_admin())
  with check (public.is_admin() or status in ('canceled', 'completed'));

-- quotes
drop policy if exists "quotes read" on public.quotes;
create policy "quotes read" on public.quotes for select using (
  vendor_id = public.my_vendor_id() or public.is_admin() or public.owns_request(quotes.request_id)
);
drop policy if exists "quotes insert" on public.quotes;
create policy "quotes insert" on public.quotes for insert with check (
  vendor_id = public.my_vendor_id() and status = 'submitted' and public.request_is_open(request_id)
);
drop policy if exists "quotes update" on public.quotes;
create policy "quotes update" on public.quotes for update using (vendor_id = public.my_vendor_id() and status = 'submitted')
  with check (status = 'submitted');

-- messages: 해당 요청의 고객 또는 해당 업체만
drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select using (
  public.is_admin() or vendor_id = public.my_vendor_id() or public.owns_request(messages.request_id)
);
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert with check (
  sender_id = auth.uid() and (vendor_id = public.my_vendor_id() or public.owns_request(request_id))
);

-- payments: 조회만 (생성은 create_payment, 승인은 서버 함수가 service_role 로 처리)
drop policy if exists "payments read" on public.payments;
create policy "payments read" on public.payments for select using (
  customer_id = auth.uid() or vendor_id = public.my_vendor_id() or public.is_admin()
);

-- settings
drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select using (true);
drop policy if exists "settings admin" on public.settings;
create policy "settings admin" on public.settings for update using (public.is_admin());

-- =============================================================
--  현장 사진 (Supabase Storage, 비공개 버킷)
--  - 경로: {업로더 user id}/{uuid}.jpg
--  - 업로드: 로그인 사용자가 자기 폴더에만 (jpg, 10MB 이하)
--  - 열람: 해당 사진이 첨부된 요청을 조회할 수 있는 사람만 (requests RLS 를 그대로 따름)
-- =============================================================
alter table public.requests add column if not exists photos text[] not null default '{}';
alter table public.requests drop constraint if exists requests_photos_max;
alter table public.requests add constraint requests_photos_max check (coalesce(array_length(photos, 1), 0) <= 5);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-photos', 'request-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg'];

drop policy if exists "request photos upload" on storage.objects;
create policy "request photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "request photos delete own" on storage.objects;
create policy "request photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "request photos read" on storage.objects;
create policy "request photos read" on storage.objects for select to authenticated
  using (
    bucket_id = 'request-photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.requests r where name = any (r.photos))  -- requests RLS 적용됨
    )
  );

-- =============================================================
--  관리자 콘솔 (/admin) 용 컬럼 · 권한
-- =============================================================
alter table public.profiles add column if not exists email text;
alter table public.vendors  add column if not exists admin_memo text;
alter table public.payments add column if not exists settlement_status text not null default 'pending';
alter table public.payments add column if not exists settled_at timestamptz;
alter table public.payments add column if not exists refund_reason text;
alter table public.payments add column if not exists refunded_at timestamptz;

-- 가입 시 이메일도 프로필에 저장
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'phone',
    new.email,
    case when new.raw_user_meta_data->>'role' = 'vendor' then 'vendor' else 'customer' end
  );
  return new;
end $$;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update using (public.is_admin());

drop policy if exists "payments admin update" on public.payments;
create policy "payments admin update" on public.payments for update using (public.is_admin());

-- =============================================================
--  법령 대응 (2026-11 보완): 허가 검증 · 집단민원현장 · 특수경비 · 동의 기록
-- =============================================================
alter table public.vendors  add column if not exists licenses text[] not null default '{}';     -- 경비업 허가 업무
alter table public.vendors  add column if not exists license_no text;                            -- 경비업 허가번호
alter table public.vendors  add column if not exists sanitation_no text;                         -- 건물위생관리업 신고번호
alter table public.vendors  add column if not exists special_agent text;                         -- 특수경비 경비대행업자
alter table public.vendors  add column if not exists docs jsonb not null default '[]';           -- 허가증 등 [{name, path}]
alter table public.vendors  add column if not exists is_operator boolean not null default false; -- 운영사 직영
alter table public.requests add column if not exists collective_site text not null default '';  -- 집단민원현장 유형
alter table public.requests add column if not exists facility_type text;                         -- 특수경비 시설 유형
alter table public.profiles add column if not exists consents jsonb not null default '{}';

-- 분야 ↔ 필요 허가 (assets/js/config.js 의 CATEGORY_REQUIRES 와 동일하게 유지)
create or replace function public.category_allowed(p_category text, p_licenses text[], p_sanitation text) returns boolean
language sql immutable as $$
  select case p_category
    when '시설경비'          then '시설경비' = any(p_licenses)
    when '신변보호'          then '신변보호' = any(p_licenses)
    when '혼잡·교통유도'     then '혼잡·교통유도경비' = any(p_licenses)
    when '이주관리·범죄예방' then '시설경비' = any(p_licenses)
    when '행정대집행지원'    then '시설경비' = any(p_licenses)
    when '특수경비'          then '특수경비' = any(p_licenses)
    when '청소대행'          then coalesce(p_sanitation, '') <> ''
    else false end;
$$;

create or replace function public.validate_vendor() returns trigger
language plpgsql as $$
declare c text;
begin
  foreach c in array new.categories loop
    if not public.category_allowed(c, new.licenses, new.sanitation_no) then
      raise exception '허가(신고)가 없는 분야는 선택할 수 없습니다: %', c;
    end if;
  end loop;
  if array_length(new.licenses, 1) > 0 and coalesce(new.license_no, '') = '' then
    raise exception '경비업 허가번호가 필요합니다.';
  end if;
  return new;
end $$;
drop trigger if exists trg_validate_vendor on public.vendors;
create trigger trg_validate_vendor before insert or update on public.vendors for each row execute function public.validate_vendor();

-- 업체가 직영 표시·심사상태를 스스로 바꾸지 못하게 + 허가 정보 변경 시 재심사
create or replace function public.protect_vendor_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.rating := old.rating; new.review_count := old.review_count; new.owner_id := old.owner_id;
    new.is_operator := old.is_operator; new.admin_memo := old.admin_memo;
    if old.status = 'rejected'
       or new.licenses is distinct from old.licenses
       or new.license_no is distinct from old.license_no
       or new.sanitation_no is distinct from old.sanitation_no
       or new.docs is distinct from old.docs then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;

drop policy if exists "vendors insert" on public.vendors;
create policy "vendors insert" on public.vendors for insert
  with check (owner_id = auth.uid() and status = 'pending' and is_operator = false);

-- 특수경비: 사진 첨부 금지, 시설 유형 필수
alter table public.requests drop constraint if exists requests_special_rules;
alter table public.requests add constraint requests_special_rules check (
  category <> '특수경비' or (coalesce(array_length(photos, 1), 0) = 0 and coalesce(facility_type, '') <> '')
);

-- 업체는 "자기 분야·지역에 맞는" 공개 요청만 조회 (특수경비 요청은 특수경비 허가 업체만)
create or replace function public.vendor_matches(p_category text, p_region text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vendors v
    where v.owner_id = auth.uid() and v.status = 'approved'
      and p_category = any (v.categories)
      and ('전국' = any (v.regions) or p_region = '전국' or p_region = any (v.regions))
  );
$$;
drop policy if exists "requests read" on public.requests;
create policy "requests read" on public.requests for select using (
  customer_id = auth.uid() or public.is_admin()
  or (public.my_vendor_id() is not null and (
        (status = 'open' and target_vendor_id is null and public.vendor_matches(category, region))
        or target_vendor_id = public.my_vendor_id()
        or public.vendor_quoted(requests.id)
  ))
);

-- 견적 제출도 매칭되는 요청에만
drop policy if exists "quotes insert" on public.quotes;
create policy "quotes insert" on public.quotes for insert with check (
  vendor_id = public.my_vendor_id() and status = 'submitted' and public.request_is_open(request_id)
  and exists (select 1 from public.requests r where r.id = request_id)  -- requests RLS 로 매칭 여부 확인
);

-- 가입 동의 기록
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone, email, role, consents)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'phone',
    new.email,
    case when new.raw_user_meta_data->>'role' = 'vendor' then 'vendor' else 'customer' end,
    jsonb_build_object(
      'terms_at', case when (new.raw_user_meta_data->>'terms_agreed')::boolean then now() end,
      'privacy_at', case when (new.raw_user_meta_data->>'privacy_agreed')::boolean then now() end,
      'marketing', coalesce((new.raw_user_meta_data->>'marketing')::boolean, false)
    )
  );
  return new;
end $$;

-- 업체 제출 서류 (비공개): 본인 업로드, 본인·관리자만 열람
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-docs', 'vendor-docs', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf'];

drop policy if exists "vendor docs upload" on storage.objects;
create policy "vendor docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "vendor docs read" on storage.objects;
create policy "vendor docs read" on storage.objects for select to authenticated
  using (bucket_id = 'vendor-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- =============================================================
--  공동 관리자 업무함 · 비회원 문의 · 나라장터 입찰 (2026-11)
-- =============================================================
alter table public.profiles add column if not exists title text;   -- 직책 (대표이사, 사내이사)

-- 비회원 견적문의
alter table public.requests alter column customer_id drop not null;
alter table public.requests add column if not exists is_guest boolean not null default false;
-- 비회원 연락처는 요청 테이블과 분리 → 업체는 볼 수 없고 관리자만 열람
create table if not exists public.guest_contacts (
  request_id uuid primary key references public.requests(id) on delete cascade,
  name text not null,
  phone text not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_guest_contacts_phone on public.guest_contacts (phone);
alter table public.guest_contacts enable row level security;
drop policy if exists "guest contacts admin" on public.guest_contacts;
create policy "guest contacts admin" on public.guest_contacts for select using (public.is_admin());

-- 휴대폰 인증번호 (서버 함수 전용: RLS 정책 없음 = 클라이언트 접근 불가)
create table if not exists public.otp_codes (
  id bigint generated always as identity primary key,
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_otp_phone on public.otp_codes (phone, created_at desc);
alter table public.otp_codes enable row level security;

-- 관리자 공동 업무함
create table if not exists public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  type text not null,            -- guest_inquiry, request, vendor_review, payment, settle, refund, bid
  ref_id text,
  title text not null,
  detail text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  assignee text,
  read_by uuid[] not null default '{}',
  events jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists idx_tasks_status on public.admin_tasks (status, created_at desc);
alter table public.admin_tasks enable row level security;
drop policy if exists "tasks admin" on public.admin_tasks;
create policy "tasks admin" on public.admin_tasks for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.add_task(p_type text, p_ref text, p_title text, p_detail text) returns void
language sql security definer set search_path = public as $$
  insert into admin_tasks (type, ref_id, title, detail, events)
  values (p_type, p_ref, p_title, p_detail, jsonb_build_array(jsonb_build_object('at', now(), 'by', '시스템', 'action', '접수 · 관리자 2인 알림')));
$$;

create or replace function public.task_on_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_guest then   -- 비회원 문의는 guest_contacts 저장 시 업무 등록
      perform public.add_task('request', new.id::text, new.title, new.customer_name || ' · ' || new.category || ' · ' || new.region);
    end if;
  elsif new.status = 'completed' and old.status <> 'completed' then
    perform public.add_task('settle', new.id::text, new.title, '고객 서비스 완료 확인 → PG 지급대행 정산 진행');
  end if;
  return new;
end $$;
drop trigger if exists trg_task_request on public.requests;
create trigger trg_task_request after insert or update of status on public.requests for each row execute function public.task_on_request();

create or replace function public.task_on_guest() returns trigger
language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = new.request_id;
  perform public.add_task('guest_inquiry', new.request_id::text, r.title,
    new.name || ' · ' || left(new.phone, 3) || '-****-' || right(new.phone, 4) || ' · ' || r.category || ' · ' || r.region || ' — 연락 필요');
  return new;
end $$;
drop trigger if exists trg_task_guest on public.guest_contacts;
create trigger trg_task_guest after insert on public.guest_contacts for each row execute function public.task_on_guest();

create or replace function public.task_on_vendor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending' or new.docs is distinct from old.docs) then
    perform public.add_task('vendor_review', new.id::text, new.company || ' 업체 심사', array_to_string(new.categories, ', '));
  end if;
  return new;
end $$;
drop trigger if exists trg_task_vendor on public.vendors;
create trigger trg_task_vendor after insert or update on public.vendors for each row execute function public.task_on_vendor();

create or replace function public.task_on_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status <> 'paid' then
    perform public.add_task('payment', new.id::text, coalesce(new.order_name, new.order_id), to_char(new.amount, 'FM999,999,999,999') || '원 결제 완료');
  elsif new.status = 'refunded' and old.status <> 'refunded' then
    perform public.add_task('refund', new.id::text, coalesce(new.order_name, new.order_id), '환불 · 사유: ' || coalesce(new.refund_reason, '-'));
  end if;
  return new;
end $$;
drop trigger if exists trg_task_payment on public.payments;
create trigger trg_task_payment after update of status on public.payments for each row execute function public.task_on_payment();

-- 나라장터 입찰 공고
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  bid_no text not null,
  bid_ord text not null default '000',
  title text not null,
  org text, demand_org text, region_limit text default '',
  close_at timestamptz, open_at timestamptz,
  base_amount bigint, presumed_price bigint,
  url text, keyword text, raw jsonb,
  status text not null default 'new' check (status in ('new', 'review', 'go', 'submitted', 'won', 'lost', 'skip')),
  assignee text, memo text, my_amount bigint,
  updated_by text, updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bid_no, bid_ord)
);
alter table public.bids enable row level security;
drop policy if exists "bids admin" on public.bids;
create policy "bids admin" on public.bids for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.task_on_bid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.add_task('bid', new.id::text, new.title, coalesce(new.org, '') || ' · 마감 ' || coalesce(to_char(new.close_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'), '-') || coalesce(' · 지역제한 ' || nullif(new.region_limit, ''), ''));
  return new;
end $$;
drop trigger if exists trg_task_bid on public.bids;
create trigger trg_task_bid after insert on public.bids for each row execute function public.task_on_bid();

-- 나라장터 2단계: 개찰 결과
alter table public.bids add column if not exists participants int;
alter table public.bids add column if not exists our_rank int;
alter table public.bids add column if not exists our_rate numeric(7,3);
alter table public.bids add column if not exists winner_name text;
alter table public.bids add column if not exists winner_bizno text;
alter table public.bids add column if not exists winner_amount bigint;
alter table public.bids add column if not exists winner_rate numeric(7,3);
alter table public.bids add column if not exists result_note text;
alter table public.bids add column if not exists result_checked_at timestamptz;
alter table public.bids add column if not exists result_source text;   -- nara | manual

-- ★ 문자 알림 연결: Supabase 대시보드 > Database > Webhooks > Create
--   Table: admin_tasks / Events: INSERT / Type: HTTP Request / Method: POST
--   URL: https://<사이트 도메인>/api/notify
--   HTTP Headers: x-webhook-secret = <Vercel 환경변수 NOTIFY_SECRET 과 같은 값>

-- =============================================================
--  관리자 지정: 가입 후 아래 이메일을 바꿔 실행하세요.
--  update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'admin@your-company.com');
-- =============================================================

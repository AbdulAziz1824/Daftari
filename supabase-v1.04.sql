-- ==========================================================
--  تحديث V1.04: حسابات باسم مستخدم + لوحة الأدمن + آخر ظهور
--  شغّله مرة واحدة في: Supabase > SQL Editor > New query > Run
--  (آمن للتشغيل أكثر من مرة). يفترض أنك شغّلت V1.03 قبله.
-- ==========================================================

-- آخر ظهور للمستخدم
alter table profiles add column if not exists last_seen_at timestamptz;

-- أسماء المستخدمين: تُقرأ من الخادم فقط (بدون سياسات = ممنوع على المتصفح)
create table if not exists usernames (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_lower text not null unique,
  login_email text not null,
  created_at timestamptz not null default now()
);
alter table usernames enable row level security;

-- الأدمن: لا أحد يقدر يضيف نفسه من المتصفح (لا توجد سياسة إدخال)
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;
drop policy if exists "read_own_admin_row" on admins;
create policy "read_own_admin_row" on admins for select using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$ language sql security definer stable set search_path = public;

-- الأدمن يحذف أي منشور أو رد في المجتمع، والمستخدم يحذف خاصته
drop policy if exists "delete_own_posts" on community_posts;
drop policy if exists "delete_own_comments" on community_comments;
create policy "delete_own_posts" on community_posts for delete using (auth.uid() = user_id or public.is_admin());
create policy "delete_own_comments" on community_comments for delete using (auth.uid() = user_id or public.is_admin());

-- الأدمن يرى كل البلاغات ويحذفها
drop policy if exists "read_own_reports" on community_reports;
drop policy if exists "admin_delete_reports" on community_reports;
create policy "read_own_reports" on community_reports for select using (auth.uid() = user_id or public.is_admin());
create policy "admin_delete_reports" on community_reports for delete using (public.is_admin());

-- ==========================================================
--  جعل حسابك أدمن: غيّر القيمة بين علامتي الاقتباس ثم شغّل السطر
--  (بريدك الذي تسجل به، أو اسم المستخدم لو حسابك باسم مستخدم)
-- ==========================================================
-- insert into admins (user_id) select id from auth.users where email = 'ضع-بريدك-هنا' on conflict do nothing;
-- insert into admins (user_id) select user_id from usernames where username_lower = 'اسم-المستخدم' on conflict do nothing;

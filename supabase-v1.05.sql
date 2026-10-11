-- ==========================================================
--  تحديث V1.05: سجل الدخول + الجهاز (تبويب "المطور")
--  شغّله مرة واحدة في: Supabase > SQL Editor > New query > Run
--  (آمن للتشغيل أكثر من مرة). يفترض أنك شغّلت V1.04 قبله.
-- ==========================================================

create table if not exists login_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null default 'login',      -- login = تسجيل دخول | open = فتح التطبيق
  ip text,
  device_type text,                         -- mobile | tablet | desktop
  os text,
  browser text,
  model text,
  standalone boolean not null default false, -- مفتوح كتطبيق مثبّت؟
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists login_logs_created_idx on login_logs (created_at desc);
create index if not exists login_logs_user_idx on login_logs (user_id, created_at desc);

-- بدون أي سياسات = ممنوع على المتصفح، تُقرأ وتُكتب من الخادم فقط (مثل جدول usernames)
alter table login_logs enable row level security;

-- ==========================================================
--  جعل حساب DEV2090 أدمن (شغّل هذا السطر فقط بعد إنشاء الحساب من صفحة التسجيل)
-- ==========================================================
-- insert into admins (user_id) select user_id from usernames where username_lower = 'dev2090' on conflict do nothing;

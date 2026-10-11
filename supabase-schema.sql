-- ==========================================================
--  موقع فزعة - إعداد قاعدة البيانات على Supabase
--  انسخ هذا الملف كاملاً والصقه في: Supabase Dashboard > SQL Editor > New query
--  ثم اضغط Run
-- ==========================================================

-- تفعيل توليد المعرفات العشوائية (uuid)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- جدول الملف الشخصي لكل مستخدم (مرتبط تلقائيًا بحساب المصادقة)
-- ---------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  notifications_enabled boolean not null default false,
  notification_email text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- جدول الملفات (ملفاتي)
-- ---------------------------------------------------------
create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- جدول الأسئلة (داخل كل ملف)
-- ---------------------------------------------------------
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  question text not null,
  image_url text,
  answer text,
  explanation text,
  difficulty text,
  status text not null default 'لم أراجعه',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- جدول الملاحظات
-- ---------------------------------------------------------
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- جدول الاختبارات (جدولي)
-- ---------------------------------------------------------
create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exam_date date not null,
  exam_time time,
  reminder_days text,
  created_at timestamptz not null default now()
);

-- ==========================================================
-- تفعيل الحماية على مستوى الصفوف (RLS) — كل مستخدم يرى بياناته فقط
-- ==========================================================
alter table profiles enable row level security;
alter table folders enable row level security;
alter table questions enable row level security;
alter table notes enable row level security;
alter table exams enable row level security;

-- سياسات profiles
create policy "select_own_profile" on profiles for select using (auth.uid() = id);
create policy "insert_own_profile" on profiles for insert with check (auth.uid() = id);
create policy "update_own_profile" on profiles for update using (auth.uid() = id);
create policy "delete_own_profile" on profiles for delete using (auth.uid() = id);

-- سياسات folders
create policy "select_own_folders" on folders for select using (auth.uid() = user_id);
create policy "insert_own_folders" on folders for insert with check (auth.uid() = user_id);
create policy "update_own_folders" on folders for update using (auth.uid() = user_id);
create policy "delete_own_folders" on folders for delete using (auth.uid() = user_id);

-- سياسات questions
create policy "select_own_questions" on questions for select using (auth.uid() = user_id);
create policy "insert_own_questions" on questions for insert with check (auth.uid() = user_id);
create policy "update_own_questions" on questions for update using (auth.uid() = user_id);
create policy "delete_own_questions" on questions for delete using (auth.uid() = user_id);

-- سياسات notes
create policy "select_own_notes" on notes for select using (auth.uid() = user_id);
create policy "insert_own_notes" on notes for insert with check (auth.uid() = user_id);
create policy "update_own_notes" on notes for update using (auth.uid() = user_id);
create policy "delete_own_notes" on notes for delete using (auth.uid() = user_id);

-- سياسات exams
create policy "select_own_exams" on exams for select using (auth.uid() = user_id);
create policy "insert_own_exams" on exams for insert with check (auth.uid() = user_id);
create policy "update_own_exams" on exams for update using (auth.uid() = user_id);
create policy "delete_own_exams" on exams for delete using (auth.uid() = user_id);

-- ==========================================================
-- إنشاء صف profile تلقائيًا عند تسجيل أي مستخدم جديد
-- ==========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'مستخدم جديد'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================================
-- تخزين صور الأسئلة (Storage) — شغّل هذا الجزء أيضًا
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

create policy "public_read_question_images"
on storage.objects for select
using (bucket_id = 'question-images');

create policy "authenticated_upload_question_images"
on storage.objects for insert
with check (bucket_id = 'question-images' and auth.role() = 'authenticated');

create policy "authenticated_delete_own_question_images"
on storage.objects for delete
using (bucket_id = 'question-images' and auth.role() = 'authenticated');

-- ==========================================================
--  تحديث V1.03: المجتمع + الفزعة (ربط الذكاء الاصطناعي) + التاغات
--  شغّله مرة واحدة في: Supabase > SQL Editor > New query > Run
--  (آمن للتشغيل أكثر من مرة)
-- ==========================================================

-- التاغات (إذا شغّلت supabase-add-tags.sql سابقًا فلن يتأثر شيء)
alter table notes add column if not exists tags text[] not null default '{}';

-- ---------------------------------------------------------
-- المجتمع: المنشورات (أسئلة مشاركة)
-- ---------------------------------------------------------
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  question text not null check (char_length(question) between 1 and 3000),
  image_url text check (image_url is null or image_url like 'https://%/storage/v1/object/public/question-images/%'),
  source_question_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists community_posts_created_idx on community_posts (created_at desc);

-- التعليقات والإجابات
create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  kind text not null default 'comment' check (kind in ('comment', 'answer')),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx on community_comments (post_id, created_at);

-- البلاغات (تراجعها أنت من Table Editor)
create table if not exists community_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references community_posts(id) on delete cascade,
  comment_id uuid references community_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- اسم الكاتب يُؤخذ من الملف الشخصي دائمًا (لمنع انتحال أسماء الآخرين)
create or replace function public.set_author_name()
returns trigger as $$
begin
  new.author_name := coalesce((select name from public.profiles where id = new.user_id), 'مستخدم');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists community_posts_author on community_posts;
create trigger community_posts_author before insert on community_posts
  for each row execute procedure public.set_author_name();

drop trigger if exists community_comments_author on community_comments;
create trigger community_comments_author before insert on community_comments
  for each row execute procedure public.set_author_name();

alter table community_posts enable row level security;
alter table community_comments enable row level security;
alter table community_reports enable row level security;

drop policy if exists "read_posts" on community_posts;
drop policy if exists "insert_own_posts" on community_posts;
drop policy if exists "delete_own_posts" on community_posts;
create policy "read_posts" on community_posts for select using (auth.role() = 'authenticated');
create policy "insert_own_posts" on community_posts for insert with check (auth.uid() = user_id);
create policy "delete_own_posts" on community_posts for delete using (auth.uid() = user_id);

drop policy if exists "read_comments" on community_comments;
drop policy if exists "insert_own_comments" on community_comments;
drop policy if exists "delete_own_comments" on community_comments;
create policy "read_comments" on community_comments for select using (auth.role() = 'authenticated');
create policy "insert_own_comments" on community_comments for insert with check (auth.uid() = user_id);
create policy "delete_own_comments" on community_comments for delete using (auth.uid() = user_id);

drop policy if exists "insert_own_reports" on community_reports;
drop policy if exists "read_own_reports" on community_reports;
create policy "insert_own_reports" on community_reports for insert with check (auth.uid() = user_id);
create policy "read_own_reports" on community_reports for select using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- الفزعة: ربط الذكاء الاصطناعي (المفاتيح تُحفظ مشفّرة ولا يقرؤها المتصفح)
-- ---------------------------------------------------------
create table if not exists ai_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  encrypted_key text not null,
  key_hint text,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table ai_connections enable row level security;
-- بدون أي سياسة = ممنوع على المتصفح تمامًا، والخادم فقط (service role) يصل للجدول

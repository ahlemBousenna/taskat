-- ==============================================================================
-- إعداد قاعدة بيانات منصة مهامي (Taskati / Taskini) على Supabase
-- متوافق تماماً مع الحسابات والمشاريع الجديدة أو الحالية (Clean & Idempotent Setup)
-- قم بنسخ الكود بالكامل ولصقه في قسم SQL Editor في لوحة تحكم Supabase ثم اضغط Run
-- ==============================================================================

-- 1. جدول ملفات تعريف المستخدمين (Profiles)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  avatar_url text,
  is_ai_enabled boolean default false,
  azure_ai_key text,
  azure_ai_endpoint text,
  azure_ai_model text default 'gpt-4o',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. جدول مجموعات العمل (task_groups)
create table if not exists public.task_groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  color text not null default 'classic',
  date date not null default current_date,
  created_by uuid references public.profiles(id) on delete cascade not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  is_permanent boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. جدول المحطات الكبرى للمشاريع (project_milestones)
create table if not exists public.project_milestones (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  due_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'delayed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. جدول استوديو إنتاج فيديوهات يوتيوب والريلز (youtube_videos)
create table if not exists public.youtube_videos (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  thumbnail_url text,
  content_type text not null default 'video' check (content_type in ('video', 'reel')),
  duration_seconds integer default 0,
  status text not null default 'planning' check (status in ('planning', 'in_progress', 'completed', 'published')),
  target_hours integer default 0,
  user_id uuid references public.profiles(id) on delete cascade not null,
  steps jsonb default '[
    {"id": "1", "title": "البحث وفكرة الفيديو", "completed": false, "work_minutes": 0, "phase": "scripting"},
    {"id": "2", "title": "دراسة المنافسين والمحتوى", "completed": false, "work_minutes": 0, "phase": "scripting"},
    {"id": "3", "title": "كتابة السيناريو (السكربت)", "completed": false, "work_minutes": 0, "phase": "scripting"},
    {"id": "4", "title": "تسجيل التعليق الصوتي", "completed": false, "work_minutes": 0, "phase": "recording"},
    {"id": "5", "title": "توليد صور المشاهد (nano banana)", "completed": false, "work_minutes": 0, "phase": "editing"},
    {"id": "6", "title": "تحويل الصور لفيديوهات (vio/omni)", "completed": false, "work_minutes": 0, "phase": "editing"},
    {"id": "7", "title": "المونتاج والمؤثرات الصوتية والبصرية", "completed": false, "work_minutes": 0, "phase": "editing"},
    {"id": "8", "title": "تصميم الصورة المصغرة", "completed": false, "work_minutes": 0, "phase": "publishing"},
    {"id": "9", "title": "تحسين السيو (العنوان والوصف)", "completed": false, "work_minutes": 0, "phase": "publishing"},
    {"id": "10", "title": "النشر والإطلاق على يوتيوب", "completed": false, "work_minutes": 0, "phase": "publishing"}
  ]'::jsonb,
  script text,
  storyboard jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

-- 5. جدول المهام (tasks)
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.task_groups(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'late')),
  assigned_to uuid references public.profiles(id) on delete set null,
  color text not null default 'classic',
  due_date date not null,
  completed_date date,
  migrated_from_date date,
  work_minutes integer not null default 0,
  video_id uuid references public.youtube_videos(id) on delete set null,
  video_phase text check (video_phase in ('scripting', 'recording', 'editing', 'publishing', 'other')),
  milestone_id uuid references public.project_milestones(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. جدول ملفات المهام (task_files)
create table if not exists public.task_files (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. جدول أوقات توفر المستخدمين وجدول المواعيد (user_availability)
create table if not exists public.user_availability (
  user_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  hour integer not null check (hour between 0 and 23),
  status text not null default 'unavailable' check (status in ('available', 'unavailable', 'maybe')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, day_of_week, hour)
);

-- 8. جدول اللقاءات اليومية السريعة (daily_standups)
create table if not exists public.daily_standups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  today_tasks text not null,
  tomorrow_tasks text not null,
  blockers text,
  mood text not null default 'stable' check (mood in ('energetic', 'stable', 'tired', 'stressed')),
  progress_rate text not null default 'most' check (progress_rate in ('all', 'most', 'half', 'low')),
  productivity_score integer not null default 5 check (productivity_score between 1 and 5),
  work_minutes integer not null default 0,
  milestone_id uuid references public.project_milestones(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, date)
);

-- 9. جدول تفاعلات اللقاء اليومي (standup_reactions)
create table if not exists public.standup_reactions (
  id uuid default gen_random_uuid() primary key,
  standup_id uuid references public.daily_standups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  reaction_type text not null check (reaction_type in ('like', 'heart', 'haha', 'rocket', 'tada', 'eyes', 'angry', 'alert')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (standup_id, user_id)
);

-- 10. جدول تعليقات اللقاء اليومي المتداخلة (standup_comments)
create table if not exists public.standup_comments (
  id uuid default gen_random_uuid() primary key,
  standup_id uuid references public.daily_standups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  parent_id uuid references public.standup_comments(id) on delete cascade default null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. جدول حفظ اشتراكات الإشعارات (push_subscriptions)
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subscription jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, subscription)
);

-- 12. جداول استطلاعات المواعيد والاجتماعات (meeting_polls, meeting_poll_options, meeting_poll_votes)
create table if not exists public.meeting_polls (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  meeting_type text not null check (meeting_type in ('online', 'offline')),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.meeting_poll_options (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references public.meeting_polls(id) on delete cascade not null,
  proposed_date date not null,
  proposed_time time not null
);

create table if not exists public.meeting_poll_votes (
  id uuid default gen_random_uuid() primary key,
  option_id uuid references public.meeting_poll_options(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (option_id, user_id)
);

-- 13. جدول الاجتماعات المجدولة النهائية (scheduled_meetings)
create table if not exists public.scheduled_meetings (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  meeting_type text not null check (meeting_type in ('online', 'offline')),
  meeting_date date not null,
  meeting_time time not null,
  location_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 14. جداول بنك الأفكار والعصف الذهني (ideas, idea_upvotes, idea_comments)
create table if not exists public.ideas (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  category text not null default 'general',
  status text not null default 'draft' check (status in ('draft', 'discussing', 'approved', 'converted')),
  user_id uuid references public.profiles(id) on delete cascade not null,
  converted_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.idea_upvotes (
  idea_id uuid references public.ideas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (idea_id, user_id)
);

create table if not exists public.idea_comments (
  id uuid default gen_random_uuid() primary key,
  idea_id uuid references public.ideas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 15. جدول النصوص والسكربتات المرجعية للذكاء الاصطناعي (ai_reference_scripts)
create table if not exists public.ai_reference_scripts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- إعدادات الأمان وسياسات الوصول (Row Level Security - RLS)
-- ==============================================================================

-- تفعيل RLS على جميع الجداول
alter table public.profiles enable row level security;
alter table public.task_groups enable row level security;
alter table public.project_milestones enable row level security;
alter table public.youtube_videos enable row level security;
alter table public.tasks enable row level security;
alter table public.task_files enable row level security;
alter table public.user_availability enable row level security;
alter table public.daily_standups enable row level security;
alter table public.standup_reactions enable row level security;
alter table public.standup_comments enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.meeting_polls enable row level security;
alter table public.meeting_poll_options enable row level security;
alter table public.meeting_poll_votes enable row level security;
alter table public.scheduled_meetings enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_upvotes enable row level security;
alter table public.idea_comments enable row level security;
alter table public.ai_reference_scripts enable row level security;

-- 1. سياسات جدول profiles
drop policy if exists "Allow public read access to profiles" on public.profiles;
create policy "Allow public read access to profiles" on public.profiles
  for select using (true);

drop policy if exists "Allow users to update their own profile" on public.profiles;
create policy "Allow users to update their own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Allow system/admins to insert profiles" on public.profiles;
create policy "Allow system/admins to insert profiles" on public.profiles
  for insert with check (true);

-- 2. سياسات جدول task_groups
drop policy if exists "Allow admins full access to groups" on public.task_groups;
create policy "Allow admins full access to groups" on public.task_groups
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Allow users to read their own or assigned groups" on public.task_groups;
create policy "Allow users to read their own or assigned groups" on public.task_groups
  for select using (
    created_by = auth.uid() or assigned_to = auth.uid()
  );

drop policy if exists "Allow users to insert their own groups" on public.task_groups;
create policy "Allow users to insert their own groups" on public.task_groups
  for insert with check (
    created_by = auth.uid()
  );

drop policy if exists "Allow users to update their own groups" on public.task_groups;
create policy "Allow users to update their own groups" on public.task_groups
  for update using (
    created_by = auth.uid()
  );

drop policy if exists "Allow users to delete their own groups" on public.task_groups;
create policy "Allow users to delete their own groups" on public.task_groups
  for delete using (
    created_by = auth.uid()
  );

-- 3. سياسات جدول project_milestones
drop policy if exists "Allow all authenticated users to read milestones" on public.project_milestones;
create policy "Allow all authenticated users to read milestones" on public.project_milestones
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow admins full access to milestones" on public.project_milestones;
create policy "Allow admins full access to milestones" on public.project_milestones
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 4. سياسات جدول youtube_videos
drop policy if exists "Allow users to manage their own videos" on public.youtube_videos;
create policy "Allow users to manage their own videos" on public.youtube_videos
  for all using (user_id = auth.uid());

-- 5. سياسات جدول tasks
drop policy if exists "Allow admins full access to tasks" on public.tasks;
create policy "Allow admins full access to tasks" on public.tasks
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Allow users to read their own or assigned tasks" on public.tasks;
create policy "Allow users to read their own or assigned tasks" on public.tasks
  for select using (
    assigned_to = auth.uid() or exists (
      select 1 from public.task_groups
      where task_groups.id = group_id and (task_groups.created_by = auth.uid() or task_groups.assigned_to = auth.uid())
    )
  );

drop policy if exists "Allow users to insert tasks in their groups" on public.tasks;
create policy "Allow users to insert tasks in their groups" on public.tasks
  for insert with check (
    exists (
      select 1 from public.task_groups
      where task_groups.id = group_id and task_groups.created_by = auth.uid()
    )
  );

drop policy if exists "Allow users to update tasks assigned to them or in their groups" on public.tasks;
create policy "Allow users to update tasks assigned to them or in their groups" on public.tasks
  for update using (
    assigned_to = auth.uid() or exists (
      select 1 from public.task_groups
      where task_groups.id = group_id and task_groups.created_by = auth.uid()
    )
  );

drop policy if exists "Allow users to delete tasks in their groups" on public.tasks;
create policy "Allow users to delete tasks in their groups" on public.tasks
  for delete using (
    exists (
      select 1 from public.task_groups
      where task_groups.id = group_id and task_groups.created_by = auth.uid()
    )
  );

-- 6. سياسات جدول task_files
drop policy if exists "Allow users to read files of tasks they can access" on public.task_files;
create policy "Allow users to read files of tasks they can access" on public.task_files
  for select using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_id
    )
  );

drop policy if exists "Allow users to upload files to tasks they can access" on public.task_files;
create policy "Allow users to upload files to tasks they can access" on public.task_files
  for insert with check (
    exists (
      select 1 from public.tasks
      where tasks.id = task_id
    )
  );

drop policy if exists "Allow users to delete their own uploaded files or admins to delete any" on public.task_files;
create policy "Allow users to delete their own uploaded files or admins to delete any" on public.task_files
  for delete using (
    uploaded_by = auth.uid() or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 7. سياسات جدول user_availability
drop policy if exists "Allow users full access to their own availability" on public.user_availability;
create policy "Allow users full access to their own availability" on public.user_availability
  for all using (auth.uid() = user_id);

drop policy if exists "Allow admins to read all availability" on public.user_availability;
create policy "Allow admins to read all availability" on public.user_availability
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 8. سياسات جدول daily_standups
drop policy if exists "Allow all authenticated users to read standups" on public.daily_standups;
create policy "Allow all authenticated users to read standups" on public.daily_standups
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow users to insert their own standups" on public.daily_standups;
create policy "Allow users to insert their own standups" on public.daily_standups
  for insert with check (auth.uid() = user_id);

drop policy if exists "Allow users to update their own standups" on public.daily_standups;
create policy "Allow users to update their own standups" on public.daily_standups
  for update using (auth.uid() = user_id);

drop policy if exists "Allow users to delete their own standups" on public.daily_standups;
create policy "Allow users to delete their own standups" on public.daily_standups
  for delete using (auth.uid() = user_id);

-- 9. سياسات جدول standup_reactions
drop policy if exists "Allow all authenticated users to read standup_reactions" on public.standup_reactions;
create policy "Allow all authenticated users to read standup_reactions" on public.standup_reactions
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow users to manage their own reactions" on public.standup_reactions;
create policy "Allow users to manage their own reactions" on public.standup_reactions
  for all using (auth.uid() = user_id);

-- 10. سياسات جدول standup_comments
drop policy if exists "Allow all authenticated users to read standup_comments" on public.standup_comments;
create policy "Allow all authenticated users to read standup_comments" on public.standup_comments
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow users to manage their own comments" on public.standup_comments;
create policy "Allow users to manage their own comments" on public.standup_comments
  for all using (auth.uid() = user_id);

-- 11. سياسات جدول push_subscriptions
drop policy if exists "Allow users to manage their own push subscriptions" on public.push_subscriptions;
create policy "Allow users to manage their own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);

-- 12. سياسات جداول meeting_polls
drop policy if exists "Allow all authenticated users to read meeting_polls" on public.meeting_polls;
create policy "Allow all authenticated users to read meeting_polls" on public.meeting_polls
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow admins full access to meeting_polls" on public.meeting_polls;
create policy "Allow admins full access to meeting_polls" on public.meeting_polls
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Allow all authenticated users to read meeting_poll_options" on public.meeting_poll_options;
create policy "Allow all authenticated users to read meeting_poll_options" on public.meeting_poll_options
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow admins full access to meeting_poll_options" on public.meeting_poll_options;
create policy "Allow admins full access to meeting_poll_options" on public.meeting_poll_options
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Allow all authenticated users to read meeting_poll_votes" on public.meeting_poll_votes;
create policy "Allow all authenticated users to read meeting_poll_votes" on public.meeting_poll_votes
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow users to manage their own votes" on public.meeting_poll_votes;
create policy "Allow users to manage their own votes" on public.meeting_poll_votes
  for all using (auth.uid() = user_id);

-- 13. سياسات جدول scheduled_meetings
drop policy if exists "Allow all authenticated users to read scheduled_meetings" on public.scheduled_meetings;
create policy "Allow all authenticated users to read scheduled_meetings" on public.scheduled_meetings
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow admins full access to scheduled_meetings" on public.scheduled_meetings;
create policy "Allow admins full access to scheduled_meetings" on public.scheduled_meetings
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 14. سياسات جداول ideas
drop policy if exists "Allow all authenticated users to view ideas" on public.ideas;
create policy "Allow all authenticated users to view ideas" on public.ideas
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow users to create their own ideas" on public.ideas;
create policy "Allow users to create their own ideas" on public.ideas
  for insert with check (auth.uid() = user_id);

drop policy if exists "Allow owners to update their own ideas" on public.ideas;
create policy "Allow owners to update their own ideas" on public.ideas
  for update using (auth.uid() = user_id);

drop policy if exists "Allow owners/admins to delete ideas" on public.ideas;
create policy "Allow owners/admins to delete ideas" on public.ideas
  for delete using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Allow all users to view upvotes" on public.idea_upvotes;
create policy "Allow all users to view upvotes" on public.idea_upvotes
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow users to toggle their own upvote" on public.idea_upvotes;
create policy "Allow users to toggle their own upvote" on public.idea_upvotes
  for insert with check (auth.uid() = user_id);

drop policy if exists "Allow users to delete their own upvote" on public.idea_upvotes;
create policy "Allow users to delete their own upvote" on public.idea_upvotes
  for delete using (auth.uid() = user_id);

drop policy if exists "Allow all users to view idea comments" on public.idea_comments;
create policy "Allow all users to view idea comments" on public.idea_comments
  for select using (auth.role() = 'authenticated');

drop policy if exists "Allow users to insert their own comments" on public.idea_comments;
create policy "Allow users to insert their own comments" on public.idea_comments
  for insert with check (auth.uid() = user_id);

drop policy if exists "Allow owners to update their own comments" on public.idea_comments;
create policy "Allow owners to update their own comments" on public.idea_comments
  for update using (auth.uid() = user_id);

drop policy if exists "Allow owners/admins to delete comments" on public.idea_comments;
create policy "Allow owners/admins to delete comments" on public.idea_comments
  for delete using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 15. سياسات جدول ai_reference_scripts
drop policy if exists "Users can manage their own reference scripts" on public.ai_reference_scripts;
create policy "Users can manage their own reference scripts" on public.ai_reference_scripts
  for all using (user_id = auth.uid());


-- ==============================================================================
-- محفز تسجيل المستخدم التلقائي (Auth Trigger for New Users)
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'عضو جديد'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop'
    )
  )
  on conflict (id) do update set
    name = coalesce(excluded.name, profiles.name),
    email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ==============================================================================
-- تهيئة مخزن الملفات والمرفقات السحابي (Storage Bucket)
-- ==============================================================================

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do update set public = true;

-- سياسات الوصول لمخزن الملفات
drop policy if exists "Allow authenticated uploads" on storage.objects;
create policy "Allow authenticated uploads" on storage.objects
  for insert with check (
    bucket_id = 'task-attachments' and auth.role() = 'authenticated'
  );

drop policy if exists "Allow authenticated reads" on storage.objects;
create policy "Allow authenticated reads" on storage.objects
  for select using (
    bucket_id = 'task-attachments'
  );

drop policy if exists "Allow delete access" on storage.objects;
create policy "Allow delete access" on storage.objects
  for delete using (
    bucket_id = 'task-attachments' and auth.role() = 'authenticated'
  );


-- ==============================================================================
-- الفهارس لتسريع الأداء والاستعلامات (Performance Indexes)
-- ==============================================================================

create index if not exists idx_tasks_group_id on public.tasks(group_id);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_video_id on public.tasks(video_id);
create index if not exists idx_tasks_milestone_id on public.tasks(milestone_id);
create index if not exists idx_daily_standups_user_date on public.daily_standups(user_id, date);
create index if not exists idx_youtube_videos_user_id on public.youtube_videos(user_id);
create index if not exists idx_ideas_user_id on public.ideas(user_id);
create index if not exists idx_standup_comments_standup on public.standup_comments(standup_id);
create index if not exists idx_standup_reactions_standup on public.standup_reactions(standup_id);

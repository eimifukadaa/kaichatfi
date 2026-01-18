-- Enable necessary extensions
create extension if not exists "vector";
create extension if not exists "pg_trgm";
create extension if not exists "uuid-ossp";

-- DOCUMENTS TABLE
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  file_type text not null check (file_type in ('pdf', 'docx', 'txt')),
  storage_path text not null,
  status text not null check (status in ('uploading', 'processing', 'ready', 'error')) default 'uploading',
  pages_total int default 0,
  pages_done int default 0,
  ocr_language text default 'ind+eng',
  ocr_provider text default 'tesseract' check (ocr_provider in ('tesseract', 'google')),
  enhanced_ocr boolean default true,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- DOCUMENT PAGES TABLE
create table if not exists document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  page_number int,
  section_number int,
  text text not null,
  scanned boolean default false,
  ocr_confidence numeric,
  preview_image_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(document_id, page_number, section_number)
);

-- DOCUMENT CHUNKS TABLE
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  page_number int,
  section_number int,
  chunk_index int not null,
  content text not null,
  content_preview text not null,
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding vector(768), -- Adding embedding column for future compatibility or if feasible
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(document_id, page_number, section_number, chunk_index)
);

-- CHATS TABLE
create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  scope text not null check (scope in ('all', 'document')) default 'all',
  document_id uuid references documents(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MESSAGES TABLE
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz default now()
);

-- CITATIONS TABLE
create table if not exists citations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  page_number int,
  section_number int,
  chunk_id uuid not null references document_chunks(id) on delete cascade,
  snippet text not null,
  score numeric not null default 0
);

-- JOBS TABLE
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'done', 'error')) default 'queued',
  stage text not null default 'queued',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- INDEXES
create index on document_chunks using gin (tsv);
create index on documents (user_id, status);
create index on chats (user_id);
create index on messages (chat_id);
create index on jobs (status);

-- TRIGGERS FOR UPDATED_AT
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_documents_updated_at before update on documents for each row execute procedure update_updated_at_column();
create trigger update_pages_updated_at before update on document_pages for each row execute procedure update_updated_at_column();
create trigger update_chunks_updated_at before update on document_chunks for each row execute procedure update_updated_at_column();
create trigger update_chats_updated_at before update on chats for each row execute procedure update_updated_at_column();
create trigger update_jobs_updated_at before update on jobs for each row execute procedure update_updated_at_column();

-- RLS POLICIES
alter table documents enable row level security;
alter table document_pages enable row level security;
alter table document_chunks enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table citations enable row level security;
alter table jobs enable row level security;

-- Documents
create policy "Users can all their own documents" on documents for all using (auth.uid() = user_id);

-- Pages (via document)
create policy "Users can all their own pages" on document_pages for all using (
  exists (select 1 from documents where id = document_pages.document_id and user_id = auth.uid())
);

-- Chunks (via document)
create policy "Users can all their own chunks" on document_chunks for all using (
  exists (select 1 from documents where id = document_chunks.document_id and user_id = auth.uid())
);

-- Chats
create policy "Users can all their own chats" on chats for all using (auth.uid() = user_id);

-- Messages
create policy "Users can all their own messages" on messages for all using (auth.uid() = user_id);

-- Citations (via message -> chat -> user OR direct check via doc)
create policy "Users can all their own citations" on citations for all using (
  exists (select 1 from messages where id = citations.message_id and user_id = auth.uid())
);

-- Jobs
create policy "Users can all their own jobs" on jobs for all using (auth.uid() = user_id);

-- STORAGE SETUP
-- Note: 'storage' schema must exist.

insert into storage.buckets (id, name, public) 
values ('kai_docs', 'kai_docs', false) 
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('kai_previews', 'kai_previews', false) 
on conflict (id) do nothing;

-- Storage Policies
-- kai_docs
create policy "Authenticated users can upload docs" on storage.objects for insert to authenticated with check (
  bucket_id = 'kai_docs' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can select docs" on storage.objects for select to authenticated using (
  bucket_id = 'kai_docs' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can update docs" on storage.objects for update to authenticated using (
  bucket_id = 'kai_docs' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can delete docs" on storage.objects for delete to authenticated using (
  bucket_id = 'kai_docs' and (storage.foldername(name))[1] = auth.uid()::text
);

-- kai_previews
create policy "Authenticated users can upload previews" on storage.objects for insert to authenticated with check (
  bucket_id = 'kai_previews' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can select previews" on storage.objects for select to authenticated using (
  bucket_id = 'kai_previews' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can delete previews" on storage.objects for delete to authenticated using (
  bucket_id = 'kai_previews' and (storage.foldername(name))[1] = auth.uid()::text
);

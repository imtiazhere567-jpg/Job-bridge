/** Bump when the table layout changes incompatibly: older databases are wiped and re-seeded. */
export const SCHEMA_VERSION = "8";

export const SCHEMA = /* sql */ `
create table if not exists meta (
  key text primary key,
  value text not null
);

create table if not exists users (
  id serial primary key,
  name text not null,
  email text unique not null,
  phone text,
  password_hash text not null,
  kind text not null default 'owner',
  created_at timestamptz default now()
);

create table if not exists sessions (
  token text primary key,
  user_id int references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists companies (
  id serial primary key,
  owner_id int references users(id) on delete cascade,
  slug text unique not null,
  name text not null,
  industry text,
  size text,
  tagline text,
  about text,
  address text,
  city text,
  phone text,
  email text,
  website text,
  sign_as text,
  tone text,
  brand_color text not null default '#063B67',
  accent_color text not null default '#047CD3',
  logo bytea,
  logo_type text,
  slot_minutes int not null default 30,
  interview_location text,
  created_at timestamptz default now()
);

create table if not exists roles (
  id serial primary key,
  company_id int references companies(id) on delete cascade,
  slug text unique not null,
  code text unique not null,
  title text not null,
  department text,
  employment text not null default 'Full-time',
  work_mode text not null default 'On-site',
  shift text,
  hours text,
  salary_min int,
  salary_max int,
  location text,
  city text,
  openings int not null default 1,
  languages jsonb not null default '[]',
  min_experience int not null default 0,
  duties jsonb not null default '[]',
  must_have jsonb not null default '[]',
  nice_to_have jsonb not null default '[]',
  start_date date,
  notes text,
  status text not null default 'draft',
  review_note text,
  reviewed_at timestamptz,
  closed_reason text,
  description text,
  post_facebook text,
  post_instagram text,
  post_whatsapp text,
  post_linkedin text,
  poster_headline text,
  poster_tagline text,
  screening jsonb not null default '[]',
  poster jsonb,
  written_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists roles_company on roles(company_id);

create table if not exists applicants (
  id serial primary key,
  role_id int references roles(id) on delete cascade,
  user_id int references users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  city text,
  source text not null default 'website',
  cv_file text,
  cv_name text,
  cv_text text,
  cv_data bytea,
  parsed jsonb,
  answers jsonb not null default '[]',
  score int,
  band text,
  breakdown jsonb,
  summary jsonb,
  scored_by text,
  stage text not null default 'applied',
  duplicate_count int not null default 0,
  owner_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists applicants_role on applicants(role_id);
create index if not exists applicants_user on applicants(user_id);

create table if not exists availability (
  id serial primary key,
  company_id int references companies(id) on delete cascade,
  weekday int not null,
  start_time text not null,
  end_time text not null
);

create table if not exists interviews (
  id serial primary key,
  applicant_id int references applicants(id) on delete cascade,
  role_id int references roles(id) on delete cascade,
  token text unique not null,
  status text not null default 'invited',
  starts_at timestamptz,
  ends_at timestamptz,
  reminder_24_sent boolean not null default false,
  reminder_2_sent boolean not null default false,
  followup_sent boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists messages (
  id serial primary key,
  applicant_id int references applicants(id) on delete cascade,
  channel text not null,
  to_addr text,
  kind text not null,
  subject text,
  body text not null,
  direction text not null default 'out',
  status text not null default 'demo',
  error text,
  created_at timestamptz default now()
);
create index if not exists messages_applicant on messages(applicant_id);

create table if not exists activity (
  id serial primary key,
  company_id int,
  role_id int,
  applicant_id int,
  text text not null,
  created_at timestamptz default now()
);

alter table roles add column if not exists work_mode text not null default 'On-site';

alter table roles add column if not exists salary_period text not null default 'year';

alter table roles add column if not exists form_fields jsonb not null default '{}';

alter table roles add column if not exists poster_texts jsonb not null default '[]';

alter table applicants add column if not exists slug text;

create unique index if not exists applicants_slug_idx on applicants (slug);

create table if not exists role_slugs (
  slug text primary key,
  role_id int references roles(id) on delete cascade
);

create table if not exists poster_images (
  role_id int references roles(id) on delete cascade,
  size text not null,
  design text not null,
  doc jsonb not null,
  png text not null,
  updated_at timestamptz default now(),
  primary key (role_id, size)
);
`;

export const DROP =
  "drop table if exists role_slugs, poster_images, activity, messages, interviews, availability, applicants, roles, companies, sessions, users, clinic, meta cascade";

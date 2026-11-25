-- ============================================================
-- База данных портфолио: отзывы посетителей
-- Выполните этот скрипт целиком в Supabase: SQL Editor -> New query -> Run.
-- Почта владельца (админа) указана в функции is_owner ниже.
-- ============================================================

-- 1. Таблица
create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text     not null check (char_length(name) between 2 and 50),
  email       text     not null check (char_length(email) <= 100 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'),
  category    text     not null check (category in ('Работы по информатике', 'Blender', 'Figma', 'Дизайн сайта', 'Другое')),
  rating      smallint not null check (rating between 1 and 5),
  message     text     not null check (char_length(message) between 10 and 500),
  suggestion  text     check (suggestion is null or char_length(suggestion) <= 300)
);

-- 2. Владелец сайта (только эта почта может смотреть контакты, менять и удалять записи)
create or replace function public.is_owner() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'weezyosmatov@gmail.com';
$$;

-- 3. Права доступа (Row Level Security)
alter table public.reviews enable row level security;

revoke all on public.reviews from anon, authenticated;
grant insert on public.reviews to anon, authenticated;
grant select, update, delete on public.reviews to authenticated;

drop policy if exists "visitors can add reviews" on public.reviews;
create policy "visitors can add reviews" on public.reviews
  for insert to anon, authenticated with check (true);

drop policy if exists "owner can read" on public.reviews;
create policy "owner can read" on public.reviews
  for select to authenticated using (public.is_owner());

drop policy if exists "owner can update" on public.reviews;
create policy "owner can update" on public.reviews
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner can delete" on public.reviews;
create policy "owner can delete" on public.reviews
  for delete to authenticated using (public.is_owner());

-- 4. Публичное представление БЕЗ почты и предложений: его видят все посетители
create or replace view public.reviews_public
  with (security_invoker = false) as
  select id, created_at, name, category, rating, message
  from public.reviews;

revoke all on public.reviews_public from anon, authenticated;
grant select on public.reviews_public to anon, authenticated;

-- 5. Пять тестовых записей (добавляются только если таблица пуста, поэтому скрипт можно запускать повторно)
insert into public.reviews (name, email, category, rating, message, suggestion)
select * from (values
  ('Алия',    'aliya.test@example.com',   'Дизайн сайта',           5, 'Очень аккуратный и понятный дизайн, удобно искать работы по темам.', null),
  ('Данияр',  'daniyar.test@example.com', 'Blender',                4, 'Модель автомобиля выглядит здорово, хотелось бы увидеть больше ракурсов.', 'Добавить анимацию вращения.'),
  ('Мадина',  'madina.test@example.com',  'Figma',                  5, 'Прототип приложения для музыки логичный, кнопки и переходы работают.', null),
  ('Тимур',   'timur.test@example.com',   'Работы по информатике',  4, 'Таблицы и схемы подробные, понравился раздел про информационную безопасность.', 'Больше скриншотов.'),
  ('Айгерим', 'aigerim.test@example.com', 'Другое',                 5, 'Классный девиз и интересный стиль, видно, что сайт сделан с душой.', null)
) as t(name, email, category, rating, message, suggestion)
where not exists (select 1 from public.reviews);

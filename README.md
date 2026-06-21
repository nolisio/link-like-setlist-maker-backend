# link-like-setlist-maker-backend

Hono + Prisma backend for the Link! Like! setlist maker. The database runtime is Supabase Postgres.

## Local development

1. Start Supabase local:

```bash
npm run supabase:start
```

2. Apply Prisma migrations:

```bash
npm run db:migrate
```

3. Seed the catalog:

```bash
npm run db:seed
```

4. Start the API:

```bash
npm run dev
```

The default local database URL is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Supabase project setup

1. Create a new Supabase project and set a database password.
2. In the dashboard, open `Connect` and copy the Postgres connection string.
3. Set `DATABASE_URL` and `DIRECT_URL` in `.env`.
4. Create a Prisma role for production use:

```sql
create user "prisma" with password 'replace-me' bypassrls createdb;
grant "prisma" to "postgres";
grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;
alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

For this backend, use a direct Postgres connection by default. If deployment later moves to an IPv4-only or serverless environment, switch to a Supabase pooler URL at that point.

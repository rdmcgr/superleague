# World Cup 2026 Super League

A private prediction web app with:
- Google auth (Supabase)
- Chapter-based picks
- One-team-per-chapter rule
- Admin-only chapter/question control
- Pick reveal after chapter lock
- Live standings

## 1) Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run [`supabase/schema.sql`](/Users/rory/Documents/World Cup 2026/supabase/schema.sql).
3. In Supabase Auth providers, enable Google and configure OAuth redirect URL:
   - `http://localhost:3000`
   - your deployed URL later (for Vercel)
4. Copy `.env.example` to `.env.local` and fill values.
5. Install deps and start:

```bash
npm install
npm run dev
```

## 2) Promote Admin

After your first login, run in Supabase SQL editor:

```sql
update public.profiles
set is_admin = true
where email = 'your-email@example.com';
```

## 3) Game Flow

1. Admin sets Group Stage to `open` before the tournament.
2. Admin sets Group Stage to `locked` to reveal picks.
3. Admin opens Knockout Stage when ready.
4. Admin enters `results` rows to score picks and update standings.

## 4) Deploy (Vercel)

1. Push this repo to GitHub.
2. Import project in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars.
4. Deploy.

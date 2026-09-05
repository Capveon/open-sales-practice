# Keys

Copy `.env.example` to `apps/web/.env.local`. Do not commit that file.

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
OPENAI_API_KEY=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
DATABASE_URL=file:./data/osp.sqlite
```

Clerk: dedicated app. Development keys on the laptop, production keys on the host.

LiveKit: Cloud project. Same three values on the web host. The agent gets URL/key/secret from LiveKit at runtime; set `OPENAI_API_KEY` as an agent secret.

`OPENAI_API_KEY` is also required on the web host. Hangup grades the tape there.

Postgres: set `DATABASE_URL` (and `DATABASE_ADMIN_URL` only for `pnpm db:migrate`). Schema defaults to `osp`.

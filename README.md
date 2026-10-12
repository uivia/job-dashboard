<<<<<<< HEAD
# Job Dashboard

A private Next.js dashboard for tracking job applications from Gmail. It imports the last 90 days on demand, stores only extracted job data and Gmail IDs, and supports manual corrections.

## Local setup

1. Use Node.js 22.18 or newer and run `npm install`.
2. Copy `.env.example` to `.env` and fill in every value.
3. Create a PostgreSQL database, then run `npx prisma migrate deploy`.
4. Run `npm run dev` and open `http://localhost:3000`.

## Google OAuth setup

1. Create a Google Cloud project and enable the Gmail API.
2. Configure an external OAuth consent screen. Add `gjohnalvien@gmail.com` as the only intended user.
3. Add the scopes `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/gmail.readonly`.
4. Create a Web application OAuth client with these redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR_VERCEL_DOMAIN/api/auth/callback/google`
5. Put the client ID and secret in the matching environment variables.
6. Move the consent screen to **In production** so refresh tokens do not expire after seven days. A personal, unverified app can show an unverified-app warning during authorization.

## Deploy to Vercel

1. Create a Prisma Postgres database and connect it to the project.
2. Add all variables from `.env.example` to Vercel. Set `NEXTAUTH_URL` to the deployed HTTPS URL.
3. Run `npx prisma migrate deploy` against the production database.
4. Deploy, sign in with the owner account, and choose **Sync Gmail**.

## Commands

- `npm test` — core parser, matching, token, and validation checks
- `npm run typecheck` — TypeScript validation
- `npm run build` — generate Prisma Client and build Next.js
=======
# job-dashboard
>>>>>>> db562496b48e5c13992bf09e8fff48d14e012862

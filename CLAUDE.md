# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start development server on http://localhost:3000
pnpm build        # Build for production
pnpm preview      # Preview production build locally
pnpm generate     # Static generation (SSG)
```

Drizzle ORM (via `tsx`):

```bash
npx tsx ./node_modules/.bin/drizzle-kit generate  # Generate migrations from schema changes
npx tsx ./node_modules/.bin/drizzle-kit push       # Push schema directly to DB (no migration file)
npx tsx ./node_modules/.bin/drizzle-kit migrate    # Run pending migrations
```

## Architecture

This is a **Nuxt 4** full-stack application using the Nitro server engine, with file-based conventions for both frontend pages and backend API routes.

### Frontend (`app/`)

- **Framework**: Vue 3 with Vuetify 4 component library (dark theme by default).
- **State management**: Pinia with `pinia-plugin-persistedstate` — store state survives page reloads. The main store (`app/store/index.ts`) holds user preferences (theme, API key) and an OpenAI client instance.
- **Routing**: File-based via Nuxt Pages. `app/pages/index.vue` → `/`, `app/pages/chat.vue` → `/chat`, etc.
- **App shell**: `app/app.vue` provides the global layout: Vuetify app bar with navigation drawer and dark/light theme toggle. All pages render inside `<NuxtPage />`.

### Backend (`server/`)

- **Server engine**: Nitro — API routes in `server/api/` are auto-mounted. Files named `addUser.post.ts` are restricted to POST; `hello.ts` accepts any method.
- **Database**: PostgreSQL via Drizzle ORM. Schema lives in `server/db/schema/schema.ts`. The DB connection is instantiated in `server/db/index.ts` using the `DATABASE_URL` environment variable.
- **Middleware**: Server middleware like `server/middleware/logRequest.ts` wraps all API requests (Nitro auto-registers files in `server/middleware/`).
- **Utilities**: `server/utils/drizzle.ts` re-exports Drizzle helpers (`sql`, `eq`, `and`, `or`) and provides a `useDrizzle()` composable and `User` type for convenience.

### Database Schema

Tables are defined in `server/db/schema/schema.ts` using `drizzle-orm/pg-core`. Currently has a `users` table with `id` (auto-increment PK), `name`, and `email` (unique). The `drizzle.config.ts` points its `schema` field at `server/db/schema` (the directory), so Drizzle Kit picks up all `.ts` files there.

### Key Dependencies

| Package                                                 | Purpose                              |
| ------------------------------------------------------- | ------------------------------------ |
| `nuxt` ^4.5.1                                           | Full-stack framework                 |
| `vuetify` + `vuetify-nuxt-module`                       | Material Design UI                   |
| `pinia` + `@pinia/nuxt` + `pinia-plugin-persistedstate` | State management with persistence    |
| `drizzle-orm` + `drizzle-kit` + `pg`                    | PostgreSQL ORM and migration tooling |
| `openai`                                                | OpenAI API client                    |

### Environment

A `.env` file at the project root provides `DATABASE_URL` (PostgreSQL connection string used by both the app and Drizzle Kit). The `dotenv` package is imported in `drizzle.config.ts` to load it during CLI operations.

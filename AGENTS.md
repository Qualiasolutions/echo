# Repository Guidelines

## Project Structure & Module Organization
- Unpack `echo-voice-agent (2).zip` into `echo-voice-agent/`; the Vite + React client lives there.
- Feature components sit in `src/components/`; reusable logic stays in `src/hooks/` (`useVoice`, `useConversation`, `useDeepgramWebSocket`).
- Types and helpers live in `src/types/` and `src/lib/`; static assets live in `public/images/`. Keep generated `dist/` assets out of commits.
- Supabase code is in `supabase (1).zip` → `supabase/functions/` for edge handlers and `supabase/tables/` + `supabase/migrations/` for SQL.

## Build, Test, and Development Commands
- `pnpm install --prefer-offline` synchronizes dependencies; skip reinstall noise by running it once before other scripts.
- `pnpm run dev` launches the Vite dev server on `http://localhost:5173`; `pnpm run preview` serves the built bundle.
- `pnpm run build` (or `build:prod`) type-checks then creates the deployment bundle.
- `pnpm run lint` executes ESLint with React hooks rules; run `supabase functions serve chat-response` to validate backend changes locally.

## Coding Style & Naming Conventions
- Keep TypeScript strict; components use PascalCase, hooks remain prefixed with `use`, utilities stick to kebab-case filenames.
- Styling flows through Tailwind and shadcn/ui primitives—avoid bespoke CSS unless a utility gap exists.
- Prettier is enforced via ESLint; use two-space indentation and explicit return types for exported functions.

## Testing Guidelines
- Automated tests are not bundled yet; prefer Vitest in `src/__tests__/ComponentName.test.tsx` for new logic and document expected coverage.
- Smoke-test voice flows with `pnpm run dev` in Chrome, verifying idle → listening → processing → speaking transitions.
- Exercise edge functions with `curl https://<project>.supabase.co/functions/v1/chat-response -d '{...}'` and attach sample payloads to PRs.

## Commit & Pull Request Guidelines
- Adopt Conventional Commits (`feat:`, `fix:`, `chore:`) for traceable history and automation hooks.
- Split UI, Supabase, and documentation changes into focused commits; reference migration IDs when schema files move.
- PRs should include a short rationale, UI screenshots or GIFs when visuals change, environment/config updates, and linked issues or task IDs.

## Security & Configuration Tips
- Keep credentials out of git; manage keys in Vercel and Supabase dashboards and rotate anon keys after demos.
- Re-verify RLS policies after schema edits via the Supabase SQL editor.
- Align new edge function headers with `supabase/functions/chat-response` and document required environment variables alongside the change.

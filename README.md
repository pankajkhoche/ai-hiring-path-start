# AI Hiring Path

Career intelligence platform for job seekers — ATS resume scoring, AI-driven interview practice, skill assessments with real code execution, and a personalized career roadmap, in one product.

Live at [aihiringpath.in](https://aihiringpath.in)

## Architecture

This is a single Next.js 15 (App Router) application — not a separate frontend/backend/database split. The UI lives under `app/`, and every API endpoint is handled by one catch-all route handler at `app/api/[[...path]]/route.js`, which talks directly to MongoDB Atlas and the third-party services below. There's no separate backend service or repo.

That's a deliberate choice, not a shortcut. Next.js route handlers are real server-side code — same request/response model, same database access, same ability to hold secrets server-only — they're just deployed alongside the UI instead of as a separate service. At this project's scale, that buys:

- One deploy, one environment config, no CORS or API-versioning drift between two codebases.
- Every feature (resume scoring, interview grading, payments) is a request handler with normal server-side access to the database and third-party APIs — nothing sensitive runs in the browser.
- The same pattern used broadly across the Next.js/Vercel ecosystem, and by frameworks like Remix, SvelteKit, and tRPC — colocated frontend and backend, not a missing backend.

A traditional split (separate Express/FastAPI service, separate repo) would trade this simplicity for independently scaling and deploying the frontend and backend — not a need at this project's current scale, but nothing here would block moving to that later if it were.

### Project layout

```
app/
  api/[[...path]]/route.js   All backend endpoints — auth, ATS, interviews, assessments, billing, admin
  dashboard/, admin/, login/, register/, forgot-password/   UI routes
components/
  dash/                      Feature UI: ATS, interview, assessments, roadmap, jobs, billing
  ui/                        Shared design-system components
lib/
  mongodb.js, auth.js        Database connection, JWT + password hashing
  llm.js                     Multi-provider AI abstraction (OpenAI / Anthropic / Gemini, with fallback)
  judge0.js                  Sandboxed code execution for technical assessments
  razorpay.js                Payments
  email.js, sms.js, otp.js   Transactional email and OTP delivery
  i18n/                      Translation dictionaries (6 languages)
```

## Stack

- **Framework:** Next.js 15 (App Router), React 18, Tailwind CSS
- **Database:** MongoDB Atlas
- **AI:** Multi-provider LLM layer (OpenAI, Anthropic, Google) with automatic fallback
- **Code execution:** Judge0 CE, sandboxed and rate-limited
- **Payments:** Razorpay
- **Hosting:** Vercel, custom domain with SSL

## Features

- ATS resume scoring and rewrite suggestions
- LinkedIn profile optimization
- AI-driven mock interviews with webcam proctoring
- Job Preparation hub: aptitude, communication, and technical assessments (MCQs, live-graded code, SQL)
- Personalized career roadmap generator
- Admin-managed job board
- Six-language UI, light/dark theme

## Local development

```bash
npm install
npm run dev
```

Requires a `.env` with `MONGO_URL`, `JWT_SECRET`, and `EMERGENT_LLM_KEY` at minimum. The third-party integrations under `lib/` (payments, code execution, email/SMS) each degrade gracefully and turn themselves off if their key isn't set, so the app runs fine without all of them configured.

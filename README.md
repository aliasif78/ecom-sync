# Ecom Sync

**Ecom Sync** prevents revenue leakage from inventory mismatch by propagating stock changes across multiple storefronts with controlled concurrency, retry safety, and operator-visible sync state.

## Architecture & Key Capabilities

- **Event-driven orchestration:** Inngest functions fan out SKU updates to all active stores, throttle per user, and retry failed tasks without blocking the request path.
- **Concurrency control at scale:** Upstash Redis distributed locks prevent duplicate or conflicting writes during burst traffic and serverless parallel execution.
- **Real-time operational feedback:** Pusher channels stream sync completion/failure events to the UI so users can monitor multi-store propagation without polling.
- **Hybrid identity and session model:** Supabase Auth (email/password, OTP reset, OAuth) is linked to MongoDB user profiles for secure auth flows with application-specific domain data.

## Tech Stack

**Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui  
**Backend:** Next.js Route Handlers + Server Actions, Inngest, Supabase Auth, Pusher, Zod  
**Infrastructure/DB:** MongoDB + Mongoose, Upstash Redis, AWS S3, PostHog

## Local Setup

```bash
git clone https://github.com/aliasif78/ecom-sync.git
cd ecom-sync
npm install
cp .env.example .env.local # or create .env.local manually
npm run dev
```

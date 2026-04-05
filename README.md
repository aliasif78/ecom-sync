# 🔄 Ecom Sync - https://ecom-sync-theta.vercel.app/

> **A multi-channel inventory synchronization engine.** Prevents revenue leakage by propagating stock changes across multiple storefronts with controlled concurrency, retry safety, and real-time state visibility.

## 🏗️ Architecture & Key Capabilities

* ⚙️ **Event-Driven Orchestration (Inngest):** Fans out SKU updates across active stores. Handles user throttling and background retries without blocking the main request path.
* 🔒 **Distributed Concurrency Control (Upstash Redis):** Employs distributed locks to completely prevent duplicate writes and race conditions during high-burst traffic.
* ⚡ **Real-Time Telemetry (Pusher):** Streams sync events (completion/failure) directly to the UI, eliminating database polling and giving operators instant feedback.
* 🛡️ **Hybrid Identity (Supabase + MongoDB):** Merges Supabase Auth (OAuth, OTP) with custom MongoDB profiles to handle complex domain data securely.

## 🛠️ Tech Stack

* **💻 Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
* **⚙️ Backend:** Next.js Route Handlers & Server Actions, Inngest, Supabase Auth, Pusher, Zod
* **🗄️ Infrastructure:** MongoDB (Mongoose), Upstash Redis, AWS S3, PostHog

## 🚀 Quick Start

```bash
git clone [https://github.com/aliasif78/ecom-sync.git](https://github.com/aliasif78/ecom-sync.git)
cd ecom-sync
npm install
cp .env.example .env.local
npm run dev

<img width="2880" height="2738" alt="screencapture-ecom-sync-theta-vercel-app-products-2026-04-05-20_37_41" src="https://github.com/user-attachments/assets/f2670499-9e3c-4dfd-9a64-5dd5075eb303" />

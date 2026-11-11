# JobBridge hiring studio

The hiring system for **JobBridge** ("Connecting talent to opportunity"). There is **one owner account with full access**. The owner posts a job; the assistant writes the job post, captions and poster text; the poster studio offers **four poster designs** to choose from, with every word and colour editable. Applicants apply on the JobBridge careers site with no account. The owner then shortlists, books interviews, chats on WhatsApp and hires.

## Run locally

```bash
npm install
npm run dev        # http://localhost:4920
```

Without `DATABASE_URL`, a built-in database is created in `data/` with demo data: four jobs (two live, one draft, one filled and closed), applicants, WhatsApp conversations and a saved poster. Delete `data/` to reset it.

The app opens on the **sign-in page** (or the dashboard, if you are already signed in). Demo owner login: **owner@jobbridge.test / Demo@1234**, or press "Open the demo dashboard". The careers pages (`/jobs`, apply, `/j/<code>`) stay public for applicants who use share links and poster QR codes.

**Brand guide** (Settings): brand colour, accent colour and writing tone. All four poster designs are built from these colours. Applicant phone numbers open a WhatsApp chat (wa.me) with a greeting ready to send.

## How it works

1. **New job.** Fill in title, salary, openings, skills and more. The assistant writes the description, social captions, screening questions and the poster headline and tagline. The job starts as a **draft**.
2. **Poster studio** (`/roles/<id>/poster`):
   - **Choose a design:** Bridge arch, Split panel, Clean card or Spotlight. Each shows your current text.
   - **Edit:** top label, title, headline, tagline, up to 4 key points, button text, and background, accent and text colours (or one-click brand palettes). The preview is live.
   - **Sizes:** Instagram/Facebook 1080×1080, LinkedIn 1200×627, WhatsApp Status 1080×1920, each downloadable.
   - **Save:** the job page, downloads and share preview use the saved poster. Text auto-shrinks so it always fits.
   - **Rewrite text with AI** asks for a fresh headline and tagline.
3. **Publish.** The job goes live on `/jobs`. The share link is `/j/<code>` (add `?s=facebook` and so on to track sources). Every poster has a QR code to the apply page. The website snippet is an iframe of `/embed`.
4. **Applicants:** CVs are read and fairly scored, sorted Strong / Maybe / Not a fit, and shortlisted with one click.
5. **Interviews:** candidates book from your free times, get reminders 24h and 2h before, and get one follow-up if they don't show.
6. **Hire.** When hires reach the number of openings, the job **closes automatically**. A button then politely tells everyone still waiting.

## Deploy (GitHub → Vercel → Supabase)

1. **Supabase:** copy *Project Settings → Database → Connection string → Transaction pooler* (port 6543) with your password.
2. **Vercel:** set `DATABASE_URL`, `DEMO_MODE=on` (portfolio) and `CRON_SECRET` (any long random text).
3. For real use: set `DEMO_MODE=off`, plus `OWNER_EMAIL`, `OWNER_PASSWORD` and optionally `OWNER_NAME`, **before the first start**.

Going live is environment variables only (see `.env.example`):
- WhatsApp: `WHATSAPP_*`
- Email: `RESEND_API_KEY`, `EMAIL_FROM`
- Claude: `ANTHROPIC_API_KEY`

## Brand

- **Logo:** `public/brand/`. The icon has been upscaled and sharpened, and there is a white version for navy backgrounds. The wordmark "JOB**BRIDGE**" and tagline are live text, so they stay sharp and readable at any size.
- **Colours:** Navy `#063B67`, Blue `#047CD3`, Sky `#3A9BE8` / `#5DB6F7`, Ice `#E7F1FB`, Silver `#8B898A`.
- **Fonts:** Montserrat 600–800 for headings (bundled in `assets/fonts`, also used on posters) and Manrope for text.
- **Motifs:** the bridge arc and four-point star from the logo, and a navy-to-blue gradient. No animations.

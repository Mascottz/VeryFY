# VeryFY

## Device Inspection

VeryFY is my premium iPhone inspection platform for repair shops, resellers and anyone who needs a clearer view of a device before making a decision.

VeryFY is being built with a calm, focused interface and a read-only diagnostic workflow. I want every result to be understandable, traceable and honest about its confidence level.

**Clarity before commitment.**

## What I have built

The current foundation includes:

- VeryFY brand identity and custom inspection mark
- Premium dashboard interface
- Battery diagnostics view
- Parts and history view
- Hardware test suite
- Inspection report preview
- Inspection history view
- Settings view
- Responsive navigation
- Device connection workflow
- Simulated inspection data for the UI prototype
- Report export and print actions
- Windows desktop shell preparation with Electron
- USB device bridge preparation
- Apple support prerequisite checks
- Optional Supabase cloud storage integration
- Supabase email and password sign-in flow
- Authenticated inspection saving and cloud history hooks
- VeryFY inspection database schema

## Current state

The browser preview uses sample iPhone data so I can refine the experience without pretending that a real device has been scanned.

The desktop foundation is prepared for the next integration stage. Real USB diagnostics will require Apple device support on Windows and the packaged iPhone communication binaries. The application must still require the user to unlock the iPhone and approve the Trust prompt.

## Run the browser preview

```bash
npm install
npm run build:web
npm run web
```

Then open the local preview shown by the development environment.

For a Vercel deployment, import the repository and add these project environment variables:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

The Vercel build generates a public browser configuration containing only the Supabase URL and anon key. Row-level security and authentication protect the inspection data.

## Run the desktop foundation

```bash
npm install
npm run dev
```

The desktop shell loads the same VeryFY interface and exposes a safe bridge for device detection and cloud operations.

## Supabase setup

I use Supabase for inspection history, report metadata, technician accounts and workspace settings. Supabase does not replace the Windows USB layer. The local desktop process remains responsible for device connection and diagnostics.

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run [`supabase/schema.sql`](supabase/schema.sql).
4. Copy `.env.example` to `.env`.
5. Add the project URL and publishable anon key to `.env`.
6. Create a test technician under Authentication, Users.
7. Sign in from the VeryFY account button before saving inspection records.
8. Keep row-level security enabled before using the project in production.

```bash
cp .env.example .env
```

I keep the local Supabase settings in `.env`, which is ignored by Git. I will never put a Supabase service role key in the desktop application.

## Project layout

```text
index.html                 VeryFY interface
styles.css                 Visual system and responsive layout
app.js                     Interface interactions and desktop bridge hooks
electron/main.cjs          Desktop process
electron/preload.cjs      Safe renderer bridge
electron/device-bridge.cjs Windows device detection foundation
electron/supabase.cjs      Cloud storage service
supabase/schema.sql        Inspection history schema
assets/veryfy-logo.svg     VeryFY application mark
assets/veryfy.ico          Windows application icon
```

## Planned build order

1. Finish the Windows prerequisite and device connection flow.
2. Bundle and test the iPhone communication layer.
3. Read the first real device values, starting with device identity and battery diagnostics.
4. Add model and iOS compatibility rules.
5. Add guided hardware tests.
6. Add authenticated Supabase history and report storage.
7. Generate signed Windows installers.
8. Test across a broad iPhone and iOS matrix before release.

## Brand reference

```text
VeryFY
Device Inspection

Clarity before commitment.

Powered by MASTECH INNOVATIONS
info@mastechinnovations.com.ng
+234 913 882 5300
```

# Cloudflare Turnstile Setup Guide

This guide walks through:

1. Creating a Cloudflare account
2. Creating a Turnstile widget
3. Adding the frontend key to this app
4. Adding the backend secret to Google Apps Script
5. Redeploying and testing

This project already has Turnstile wiring in the game page. You only need to provide the real keys and redeploy.

Official references:

- Cloudflare account creation: https://developers.cloudflare.com/fundamentals/account/create-account/
- Cloudflare Turnstile get started: https://developers.cloudflare.com/turnstile/get-started/
- Cloudflare Turnstile dashboard widget setup: https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/
- Cloudflare Turnstile client rendering: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Google Apps Script properties: https://developers.google.com/apps-script/guides/properties

## 1. Create Your Cloudflare Account

Cloudflare says you need a Cloudflare account before you can create a Turnstile widget.

Steps:

1. Go to the Cloudflare sign-up page from the official docs:
   https://developers.cloudflare.com/fundamentals/account/create-account/
2. Enter your email and password.
3. Create the account.
4. Verify your email address from the email Cloudflare sends.

Recommended:

- Use an email you control long-term.
- If this is for a team/project, use a project email instead of a personal one.
- Enable two-factor authentication after login.

Important:

- You do not need to move your domain to Cloudflare just to use Turnstile.
- Turnstile works independently and can be used on websites not proxied through Cloudflare.

## 2. Create a Turnstile Widget

After logging into Cloudflare:

1. Open the Turnstile page in the Cloudflare dashboard.
2. Click `Add widget`.
3. Fill in the widget details.

Recommended widget settings for this project:

- Widget name: `8bit Penguins Puzzle`
- Hostname management:
  - Add your production hostname, for example `8bitpenguins.xyz`
  - Add `localhost` if you also want to test locally
- Widget mode: `Managed`

Why `Managed`:

- Cloudflare recommends it as the default adaptive option.
- It is the simplest fit for this puzzle/profile/proof flow.

After creation, Cloudflare will give you:

- `site key`
- `secret key`

Important:

- The `site key` goes in the frontend.
- The `secret key` must stay private and only go on the backend.
- Never commit the secret key to the repo.

## 3. Add the Frontend Site Key

This app reads the frontend key from:

```env
VITE_TURNSTILE_SITE_KEY=
```

### Local development

Create or update your local env file:

```env
VITE_TURNSTILE_SITE_KEY=your_real_turnstile_site_key
```

You can add it to `.env.local` or your local Vite env file.

This repo already includes the placeholder in:

- [`.env.example`](/C:/Users/OLAWOYIN%20OLAMIDE/Desktop/pixel-punks-nft/mint-app/.env.example)

### Production hosting

If you deploy with Vercel or another host, add:

```env
VITE_TURNSTILE_SITE_KEY=your_real_turnstile_site_key
```

in the host's environment variable settings.

### Restart required

After setting the env var:

- restart local dev server, or
- redeploy production

Vite only reads `import.meta.env` at build/start time.

## 4. Add the Backend Secret to Apps Script

This project validates Turnstile tokens in Google Apps Script.

The script expects these Script Properties:

- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_EXPECTED_HOSTNAME` (optional but recommended)

### How to add them

In Google Apps Script:

1. Open your Apps Script project.
2. Go to `Project Settings`.
3. Find `Script Properties`.
4. Add:

```text
TURNSTILE_SECRET_KEY = your_real_turnstile_secret_key
TURNSTILE_EXPECTED_HOSTNAME = 8bitpenguins.xyz
```

For local testing, if needed, you can temporarily use:

```text
TURNSTILE_EXPECTED_HOSTNAME = localhost
```

or leave the hostname property empty while testing.

Recommended production value:

```text
TURNSTILE_EXPECTED_HOSTNAME = 8bitpenguins.xyz
```

Important:

- Do not put the secret key in frontend env vars.
- Do not hardcode the secret key in source code.

## 5. Confirm Where the Code Uses These Keys

Frontend:

- [src/PlayToWL.jsx](/C:/Users/OLAWOYIN%20OLAMIDE/Desktop/pixel-punks-nft/mint-app/src/PlayToWL.jsx)
- [src/TurnstileWidget.jsx](/C:/Users/OLAWOYIN%20OLAMIDE/Desktop/pixel-punks-nft/mint-app/src/TurnstileWidget.jsx)

Backend source:

- [docs/AppsScriptWithAdminLog.gs](/C:/Users/OLAWOYIN%20OLAMIDE/Desktop/pixel-punks-nft/mint-app/docs/AppsScriptWithAdminLog.gs)

Current behavior:

- Profile save is CAPTCHA-gated in the game page UI
- Victory proof submit is CAPTCHA-gated in the game page UI
- Apps Script validates the Turnstile token server-side before accepting puzzle proof submissions

## 6. Redeploy After Adding the Keys

### Frontend

Redeploy or restart the app after adding:

```env
VITE_TURNSTILE_SITE_KEY=...
```

### Apps Script

After adding Script Properties:

1. Open Apps Script
2. Click `Deploy`
3. Choose `Manage deployments`
4. Edit the web app deployment or create a new deployment
5. Redeploy

If you create a new deployment URL, update the frontend Apps Script URL to match it.

## 7. Test the Setup

### Frontend checks

Open the puzzle page and verify:

- The CAPTCHA widget appears under `Save & Start Game`
- The CAPTCHA widget appears under `Submit Proof`
- The buttons stay disabled until the CAPTCHA is solved

### Proof flow checks

1. Save profile after solving the CAPTCHA
2. Play and qualify
3. Solve the CAPTCHA in the proof section
4. Submit a live tweet link

Expected result:

- The button should respond immediately
- The proof should save
- The leaderboard/proof refresh should continue in the background

## 8. Troubleshooting

### Error: `Captcha is not configured right now.`

Cause:

- `VITE_TURNSTILE_SITE_KEY` is missing in the frontend environment

Fix:

- add the site key to frontend env
- restart or redeploy the frontend

### Error: CAPTCHA fails on proof submit

Cause:

- `TURNSTILE_SECRET_KEY` is missing in Apps Script
- Apps Script was not redeployed
- hostname mismatch

Fix:

1. confirm `TURNSTILE_SECRET_KEY` exists in Script Properties
2. confirm `TURNSTILE_EXPECTED_HOSTNAME` is correct
3. redeploy Apps Script

### CAPTCHA shows locally but not on production

Cause:

- production env var missing
- widget hostnames do not include your production domain

Fix:

1. add the frontend env var in hosting settings
2. confirm your Turnstile widget includes the production hostname

### CAPTCHA works on production but not on localhost

Cause:

- widget hostnames do not include `localhost`

Fix:

- add `localhost` to the Turnstile widget hostnames

## 9. Recommended Production Setup

Use separate widgets per environment:

- `8bit Penguins Puzzle Prod`
- `8bit Penguins Puzzle Dev`

Recommended hostnames:

- Production widget: `8bitpenguins.xyz`
- Dev widget: `localhost`

Recommended secret storage:

- Frontend site key in hosting env vars
- Backend secret in Apps Script Script Properties

## 10. Quick Checklist

- Cloudflare account created
- Turnstile widget created
- Production hostname added
- `localhost` added for local testing
- Site key added to frontend env
- Secret key added to Apps Script Script Properties
- Apps Script redeployed
- Frontend redeployed
- Profile form challenge visible
- Proof form challenge visible
- Proof submission succeeds

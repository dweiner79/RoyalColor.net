# Royal Color Analysis & Styling

Professional color analysis and personal styling website — built with pure HTML, CSS, and vanilla JavaScript.

**Live site:** [www.royalcolor.net](https://www.royalcolor.net)

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Landing page with hero, services overview, testimonials |
| Services | `services.html` | Detailed service packages, pricing, FAQ |
| Color Quiz | `quiz.html` | 8-question interactive color season quiz |
| About | `about.html` | Stylist bio and philosophy |
| Booking | `booking.html` | 4-step booking flow with calendar, PayPal payment |

## Tech Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript
- **Fonts:** Playfair Display + Inter (Google Fonts)
- **Payments:** PayPal SDK
- **Calendar Backend:** Google Apps Script → Google Calendar API
- **Hosting:** Azure Static Web Apps

## Project Structure

```
├── index.html
├── about.html
├── services.html
├── quiz.html
├── booking.html
├── css/
│   └── style.css
├── js/
│   ├── main.js          # Shared: nav, scroll, FAQ accordion, toast
│   └── quiz.js          # Color season quiz logic
├── images/              # Site images
├── google-apps-script.gs  # Apps Script backend (deploy separately)
├── questionnaire.md     # Client intake / personalization questionnaire
└── .gitignore
```

## Calendar Backend

The booking system uses a Google Apps Script web app to read/write Google Calendar events.

- Script source: `google-apps-script.gs`
- Deploy as: **Google Apps Script → Web App** (execute as you, anyone can access)
- Features: business-hours availability, 48-hour advance booking, 1-hour buffer between appointments

## SEO and Local Visibility Bot

The approval-first bot in `automation/seo_bot.py` runs every Monday through GitHub Actions. It:

- Audits every sitemap page for HTTP errors, metadata, canonical URLs, H1s, JSON-LD, and duplicate titles or descriptions.
- Rotates a ready-to-review Google Business Profile post draft.
- Tracks verified and outstanding local business citations.
- Opens or refreshes one GitHub issue containing the report and approval checklist.

The bot never signs in to Google, changes the Business Profile, publishes posts, changes office hours, or generates reviews. Review and publish approved copy manually from the issue. Official Business Profile API access can be added later without changing this approval model.

Run the checks locally with Python 3.10 or newer:

```powershell
python -m unittest discover -s automation -p "test_*.py" -v
python automation/seo_bot.py
```

Reports are written to `seo-bot-report/`. Update post topics, citation statuses, and URLs in `automation/seo_bot.json`; use `verified` only after confirming a listing is live and accurate. The workflow can also be started manually from **Actions → SEO and Local Visibility Monitor → Run workflow**.

## Setup Notes

1. **PayPal** — Replace the sandbox client ID in `booking.html` with a live PayPal client ID before going live.
2. **Apps Script** — Deploy `google-apps-script.gs` as a web app and update the `APPS_SCRIPT_URL` in `booking.html`.
3. **Images** — Add site images to the `images/` directory.

## License

© 2026 Royal Color Analysis & Styling. All rights reserved.

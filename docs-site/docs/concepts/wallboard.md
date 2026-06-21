---
sidebar_position: 5
title: Wallboard (TV)
---

# Wallboard (TV Dashboard)

The Wallboard is a fullscreen, read-only dashboard built to run on a TV or a dedicated monitor — a NOC-style view of your audit data that updates live without anyone having to log in.

It is served at `/tv` by the Reader service.

---

## How it works

The Wallboard uses a separate, **read-only** authentication flow so you never expose a real user account on a shared screen:

1. In the dashboard, go to **Settings → Wallboard**.
2. Generate an **activation code** (`BAT-XXXXXX`). You can create multiple named profiles (e.g. "Office TV", "Ops room").
3. Open `/tv` on the TV's browser and enter the code.
4. The screen receives a long-lived read-only token and stays connected. Tokens auto-refresh in the background.

Activation codes can be revoked at any time from the same settings page.

:::info
Wallboard tokens are scoped to `wallboard` and can only read aggregate data. They cannot access event bodies, settings, or any write endpoint.
:::

---

## Views

The Wallboard has two modes, toggled in the header.

### Dashboard view

A single-project (or all-projects) live view with:

- **Stats row** — events today, 4xx, 5xx, average response time, active services.
- **Volume chart** — request volume over the last 2 hours.
- **Top error routes** — routes with the highest error counts in the last hour.
- **Live feed** — events as they arrive.
- **Health monitors** — up/down status, auto-paginated when there are many.
- **Recent alerts** — anomaly alerts from the last 30 minutes.

### Grid view

A multi-project overview — one compact card per project, ideal for watching many services at once. Each card shows events today, average response time, 4xx and 5xx counts, and a status indicator:

- 🟢 green dot — healthy
- 🟠 orange border — has 4xx errors
- 🔴 red border — has 5xx errors or a monitor is DOWN

Click any card to jump straight into that project's Dashboard view.

---

## Filters

- **Environment** — filter the whole Wallboard by `production`, `staging`, `development`, etc. Applies to both views.
- **Project** — switch the active project in Dashboard view. (Hidden in Grid view, which always shows all projects.)

You can also deep-link a specific project by opening `/tv?project_id=<id>`.

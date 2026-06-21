---
sidebar_position: 6
title: Team & Users
---

# Team & Users

BatAudit supports multiple users with role-based access. Team management lives under **Settings → Team**.

---

## Roles

| Role | Scope | Permissions |
|---|---|---|
| `owner` | Global | See all projects, manage everything (users, retention, all settings) |
| `admin` | Per project | Manage project members and users/invites, view data, manage project settings |
| `viewer` | Per project | View dashboards and data only — no settings |

The first owner is created at startup from the `INITIAL_OWNER_EMAIL` / `INITIAL_OWNER_PASSWORD` environment variables. See [Configuration →](/self-hosting/configuration).

---

## Inviting users

Instead of creating accounts and passwords manually, you invite people with a link. Owners and admins can do this.

1. Go to **Settings → Team → Users**.
2. Enter the person's **email** and pick a **role** (`admin` or `viewer`).
3. Click **Generate Invite** — a link is created and shown immediately.
4. Copy the link and send it however you like (Slack, WhatsApp, email).
5. The invited person opens the link (`/invite/:token`), sees their email pre-filled and locked, and sets their **name and password**.
6. On submit, their account is created and they're sent to the login page.

Invites expire after **7 days** and can only be used once. Pending invites are listed on the same page and can be revoked before they're accepted.

:::note
There is no SMTP integration yet — you copy and share the link manually. Automatic email delivery is on the roadmap.
:::

---

## Members vs Users

- **Users** are accounts on the BatAudit instance (Settings → Team → Users).
- **Members** link a user to a specific project with a role (Settings → Team → Members). Owners see all projects; admins and viewers only see projects they're a member of.

# Changelog

All notable changes to BatAudit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-06-24

### Added

- **Query — SQL Console.** An Athena-style editor to run ad-hoc, read-only SQL
  over your audit data (`POST /v1/audit/query`, owner/admin only). Queries run
  inside a `READ ONLY` transaction with a statement timeout and a forced row
  limit, so writes are rejected by the database itself — not by string matching.
  A read-only PostgreSQL role (`bataudit_readonly`, migration `000016`) further
  scopes reads when provisioned.
- **Studio — Report Builder.** Build lightweight reports from multiple widgets,
  each backed by its own query and rendered as a line chart, pie chart, or
  table, arranged in a resizable grid. Save/load reports (`/v1/reports`,
  migration `000017`) and **Export PDF** for a clean, client-ready document.
- **`webhook-receiver` dev tool** (`cmd/tools/webhook-receiver`) — a tiny local
  HTTP server that logs incoming webhook deliveries (headers, body, HMAC
  signature) for debugging.

### Fixed

- **Webhooks no longer report a misleading 502.** The webhook test endpoint now
  always returns `200` with `{ ok, status_code, response, error }`, surfacing the
  real outcome: a successful delivery, the target's actual error status + body,
  or a clear "could not reach endpoint" message. The real status code is also
  preserved in delivery records (previously lost as `0`). 4xx responses are no
  longer retried.
- **Event History** now shows an explicit empty state for projects with no
  history yet, instead of rendering a blank chart.

### Security

- The Query Console is owner/admin-only and read-only at the database level
  (`READ ONLY` transaction). Known limitation: table-level read scoping requires
  the `bataudit_readonly` role to be provisioned, which needs a DB user with
  `CREATEROLE`/superuser at migration time. Where it isn't (e.g. a locked-down
  app user), the console can read any table — provision the role in production.
- On SQLite the single-statement `SELECT`-only validation is sufficient to
  prevent writes (SQLite has no data-modifying CTEs and stacked statements are
  rejected).

[1.2.0]: https://github.com/joaovrmoraes/bataudit/releases/tag/v1.2.0

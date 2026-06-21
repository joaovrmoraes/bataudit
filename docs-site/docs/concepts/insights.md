---
sidebar_position: 7
title: Insights
---

# Insights

The **Insights** page turns your raw audit data into rankings — answering "what's busiest, who's most active, and what's breaking?" without writing queries.

Open it from the main sidebar. A period selector lets you switch between **7 / 30 / 90 days**.

---

## Rankings

| Ranking | What it shows | Useful for |
|---|---|---|
| **Top Endpoints by Volume** | Most-requested `path` + `method` | Dev / DevOps — capacity & hotspots |
| **Top Users by Activity** | Most active `identifier`s | Product / CS — power users |
| **Top Routes by Error Rate** | Routes with the highest % of 4xx/5xx | Dev / Support — what's broken |
| **Top Routes by Response Time** | Slowest routes by average latency | Dev / DevOps — performance |

---

## Drill-down

Every row is clickable. Clicking a ranking entry takes you to the **Events** page with the matching filters already applied (and, for error/slow routes, scoped to the relevant events), so you can go from "this route has a 12% error rate" to the actual failing requests in one click.

---

## Filtering

Insights respects the **project** selector in the header. The period selector (7/30/90 days) controls the time window for all four rankings.

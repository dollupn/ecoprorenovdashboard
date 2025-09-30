# Leads Page Implementation Summary

The `Leads` page (`src/pages/Leads.tsx`) now consumes live data from Supabase and wires the main prospecting
workflows directly to the database. This document highlights the key behaviors so future contributors can
quickly understand how the screen operates.

## Data Loading & Synchronisation
- Leads are fetched with TanStack Query using the authenticated Supabase session. Only the current user's
  records are requested and results are ordered by `created_at` (newest first).
- Creating a lead, scheduling a rendez-vous, importing a CSV file, or creating a project all trigger a
  `refetch()` so the list always reflects the latest state stored in Supabase.
- Loading, error, empty, and filtered-empty states are rendered explicitly to keep the UI informative.

## Lead Management Actions
- **Search & Filter:** Client-side search scans the most relevant lead fields and status chips allow
  multi-select filtering. Active filters are highlighted and can be reset in one click.
- **CSV Import:** A lightweight parser supports both comma and semicolon separated files, normalises headers,
  performs field validation, and surfaces the number of skipped rows. Imported rows inherit the logged-in
  user's identifier before being inserted into Supabase.
- **Scheduling:** `ScheduleLeadDialog` lets users set rendez-vous information and update the lead status in
  one form. Submitted values are persisted in Supabase and the dialog reopens with the latest data.
- **Project Creation:** `AddProjectDialog` accepts prefilled values coming from a lead. Once the project is
  created, the originating lead is automatically marked as `CONVERTED`.

## Shared Utilities
- Lead statuses are centralised in `src/components/leads/status.ts` with helpers for labels and badge colors.
- Dialogs reuse these helpers and expose callback hooks (`onLeadAdded`, `onScheduled`, `onProjectAdded`) to
  keep the page component agnostic of their internal logic.

## Potential Enhancements
- Add pagination or infinite scrolling for very large lead volumes.
- Surface aggregate metrics (e.g. leads per status) at the top of the page.
- Offer richer CSV error reporting (line numbers, inline preview) for rejected rows.

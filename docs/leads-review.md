# Leads Page Review

This document summarizes the current implementation of `src/pages/Leads.tsx` and highlights the main gaps that prevent the page from being fully functional.

## Current State
- The UI renders using static `mockLeads` data defined inside `Leads.tsx`.
- Filtering controls (search input and "Filtres" button) are present only as UI elements with no state or logic attached.
- Action buttons such as "Importer CSV", "Planifier RDV", and "Créer Projet" do not have handlers behind them.

## Identified Missing Pieces
1. **Backend data integration**
   - The page never queries Supabase for the authenticated user's leads. All information comes from the local `mockLeads` array, so the UI will not reflect the real database content.
   - There is no loading or error state while fetching data from Supabase, nor any way to refresh the list.

2. **Synchronization after creating a lead**
   - `<AddLeadDialog />` accepts an optional `onLeadAdded` callback, but the page does not pass one in. As a result, adding a lead via the dialog will not update the list displayed on the page.

3. **Filtering and search logic**
   - The search input does not update component state or trigger any filtering. A filter button is displayed, but opening a filter panel or applying filters is not implemented.

4. **Action handlers**
   - The "Importer CSV" button should open a file picker or navigate to an import workflow, but no handler is provided.
   - The "Planifier RDV" and "Créer Projet" buttons inside each lead card are placeholders without click behavior.

5. **Data visualization and pagination**
   - There is no aggregation (e.g., counts by status) or pagination/virtualization to handle large lead lists.

These gaps need to be addressed to make the Leads page production-ready.

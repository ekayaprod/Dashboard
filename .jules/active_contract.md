# 🕴️ Hitman: Target Dossier

## Targets
1. **Target ID**: 1
   **Target**: CSV Export/Import components (Dashboard, Lookup, Mailto, Core App Data)
   **Blast Radius**: Multiple files (js/core/app-data.js, js/apps/dashboard.js, js/apps/lookup.js, js/apps/mailto.js, js/apps/dashboard.test.js, js/apps/lookup.test.js, js/apps/mailto.test.js, js/core/app-data.test.js)
   **Heuristic Justification**: The Synthetic Creep (UI). Fully functional CSV import/export features that lack specification requirements in a localized suite without a backend.

2. **Target ID**: 2
   **Target**: CI/CD Pipelines (.github/workflows)
   **Blast Radius**: 3 files (.github/workflows/ci.yml, .github/workflows/codeql.yml, .github/workflows/pages.yml)
   **Heuristic Justification**: The Synthetic Creep (Infrastructure). Cross-cutting pipeline files artificially generated in a repository designated strictly as simple client tools or single-page apps.

3. **Target ID**: 3
   **Target**: .env.example
   **Blast Radius**: 1 file
   **Heuristic Justification**: Orphaned Macro-Debris / Infrastructure Creep. Unnecessary for a purely client-side static app.

# Sidebar Productivity Suite - Roadmap & Architecture Log

## 🧭 THE CALIBRATED MAP: Explicitly linked milestone
- [x] Integrate palette UX fixes (Merged: `a4ed4cd`)

## Innovation Backlog

### Proposal: Adopt `date-fns` for Date/Time Math
* **The Problem:** The repository currently relies on a custom-built utility (`DateUtils` in `js/core/app-core.js`) to handle date and time parsing and math (e.g., `parseTimeToMinutes`, `formatMinutesToHHMM`). This is "reinventing the wheel," brittle, and prone to edge-case errors across different shift calculations in `js/apps/calculator.js`.
* **The Solution:** Adopt the mature, community-standard `date-fns` library to replace the custom date-math utility.
* **The Benefit:** Standardizing on `date-fns` will eliminate technical debt, ensure robust edge-case handling for time calculations, and simplify the codebase.

### Proposal: Adopt `Zod` for Data Validation
* **The Problem:** The codebase uses a custom, reinvented `DataValidator` module (`js/core/app-data.js`) for tasks like schema checking and duplicate detection across application state. As the suite scales, custom validation logic becomes hard to maintain and lacks strict type safety.
* **The Solution:** Implement `Zod` for strict, schema-based data validation and parsing.
* **The Benefit:** `Zod` provides robust, type-safe schema enforcement, preventing corrupted JSON payloads and improving overall operational integrity.

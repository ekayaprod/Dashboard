## 2024-05-23 - DOM vs Regex HTML Escaping
**Learning:** Using `document.createElement('p')` to escape HTML is significantly slower (~2-3x) than a regex-based approach and incurs unnecessary DOM overhead.
**Action:** Always prefer regex-based string manipulation for simple escaping tasks, especially in utility functions called frequently (e.g., render loops). Avoid touching the DOM unless absolutely necessary.

## 2024-05-24 - replaceAll vs Chained Replace
**Learning:** String.prototype.replaceAll() is ~10-15% faster than chained regex .replace() calls for HTML escaping in V8, and avoids regex compilation overhead.
**Action:** Use replaceAll for simple string replacements where pattern matching isn't required.

## 2026-03-11 - Sequential Fetch Bottlenecks
**Title**: Concurrent Word Bank Initialization
**Learning**: Sequential data fetches during application initialization (e.g., awaiting a base JSON dictionary, evaluating logic, then awaiting a seasonal JSON dictionary) create unnecessary network round-trips and structural latency. Additionally, failing to cache immutable file reads in memory results in redundant I/O on repeated logic execution.
**Action**: Isolate independent async payloads and execute them concurrently using `Promise.all()`. Apply simple in-memory caching for immutable static assets (like JSON dictionaries) to ensure they are fetched exactly once per session.

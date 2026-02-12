## 2024-05-23 - DOM vs Regex HTML Escaping
**Learning:** Using `document.createElement('p')` to escape HTML is significantly slower (~2-3x) than a regex-based approach and incurs unnecessary DOM overhead.
**Action:** Always prefer regex-based string manipulation for simple escaping tasks, especially in utility functions called frequently (e.g., render loops). Avoid touching the DOM unless absolutely necessary.

## 2024-05-24 - replaceAll vs Chained Replace
**Learning:** String.prototype.replaceAll() is ~10-15% faster than chained regex .replace() calls for HTML escaping in V8, and avoids regex compilation overhead.
**Action:** Use replaceAll for simple string replacements where pattern matching isn't required.

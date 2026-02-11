## 2024-05-23 - DOM vs Regex HTML Escaping
**Learning:** Using `document.createElement('p')` to escape HTML is significantly slower (~2-3x) than a regex-based approach and incurs unnecessary DOM overhead.
**Action:** Always prefer regex-based string manipulation for simple escaping tasks, especially in utility functions called frequently (e.g., render loops). Avoid touching the DOM unless absolutely necessary.

## 2026-04-18 - 📯 Dispatch
**Learning:** Bootstrapping CI/CD pipelines requires sequential dependencies to ensure valid actions syntax and functional npm caches over native codebases.
**Action:** Use native validators (yaml-lint) prior to suite execution to ensure robust GitHub pipeline setups.
## 2026-04-18 - 📯 Dispatch
**Learning:** GitHub Actions pages-deploy actions require explicit `permissions` block with `pages: write` and `id-token: write` to prevent 403 errors, and node environments testing modern tools like vitest 4+ must adhere to `node-version: >= 20.x` strictly.
**Action:** Use specific, current node ranges on `ci.yml` creation, and OIDC explicit permissions on pages deployment YAML.

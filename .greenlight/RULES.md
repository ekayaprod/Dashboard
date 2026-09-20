# Greenlight Rules Catalog

| Rule ID | Standard Enforced | Evidence | Fix Hint |
|---|---|---|---|
| GL-001 | Bootstrap script comment requirement | `lookup.html` and `mailto.html` explicitly enforce the inclusion of `<!-- CRITICAL: Bootstrap script must be at the END of the body. It loads the Navbar HTML and all JS dependencies in parallel. -->` before importing `bootstrap.js`. | Add the critical comment before `<script src="js/bootstrap.js"></script>`. |

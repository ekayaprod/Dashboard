# Dispatch Journal

## Abstract Axioms
- Structural integrity of YAML files must always be verified via `yamllint`.
- Workflow indentation and line lengths must adhere to strict YAML standards.
- Document start `---` is required for all YAML manifests to prevent parse ambiguities.
- Quoted strings for boolean-like keys (e.g., `"on"`) prevent unexpected structural evaluation.

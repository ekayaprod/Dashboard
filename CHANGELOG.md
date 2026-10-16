# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Architecture roadmap and intelligence report.

### Changed

- Refactored `msg-reader.js` logic for optimization.
- Updated README to reflect physical code reality and boot requirements.
- Consolidated CI pipelines and fortified deployment logic (PR #384).
- Overhauled and standardized UI component aesthetics through the Palette+ initiative, introducing fluid transitions, consistent focus rings, and polished empty states.
- Bumped development dependencies (`vitest`, `jsdom`, and `@vitest/coverage-v8`) to their latest secure versions.
- Updated GitHub Actions versions to valid tags to fix CI pipeline.
- Injected glassmorphism aesthetics, tactile feedback (`active:scale-98`), staggered fade-in animations to list items, and expanded touch targets for clear buttons.

### Fixed

- Fixed Node 20 CI build issue by downgrading jsdom.
- Removed fossilized code and diagnostic droppings from `calculator.js`.
- Cleaned codebase by removing stale TODO comments for password structure selection.
- Enhanced Dashboard and Calculator UX patterns and stylized components with fluid UX.

### Security

- Bumped github/codeql-action from 4.38.1 to 4.38.3.

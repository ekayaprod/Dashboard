# 🤝 Contributing to Sidebar Productivity Suite

Welcome! While this is primarily a personal utility, contributions that improve the existing toolset without introducing heavy dependencies or build steps are welcome.

## 🗺️ Architectural Map

The repository is structured to maintain zero build steps and immediate browser execution:

* `/` (Root): Contains the core HTML shell (`index.html`) and individual micro-application views (`dashboard.html`, `lookup.html`, `mailto.html`, `passwords.html`, `calculator.html`).
* `/js/`: Houses all vanilla ES6+ JavaScript logic.
  * `/js/bootstrap.js`: Central dependency loader.
  * `/js/workers/`: Dedicated Web Workers (e.g., `msg-reader.js` for asynchronous `.msg` parsing).
* `/e2e/`: Contains end-to-end tests using Playwright.
* `/wordbanks/`: Static JSON assets utilized by the Passwords tool for passphrase generation.

## 🧪 Local Testing Procedures

Before submitting a pull request, ensure all local test suites pass. The testing environment is built around Vitest and Playwright.

To execute the test suite locally, run the following commands:

```bash
# Install testing dependencies
npm ci

# Run the standard unit test suite (Vitest)
npm run test

# Run the unit test suite with coverage report
npm run test:coverage

# Run end-to-end browser tests (Playwright)
npm run test:e2e
```

Please do not alter the application execution flow or modify application ASTs directly unless explicitly related to fixing a failing test on main. Testing files should be treated as immutable unless you are proving a failure on main.

# 📘 Contributing Guide

Welcome! Thank you for looking into the Sidebar Productivity Suite.

> **⚠️ Executive Disclaimer:** The Sidebar Productivity Suite is a localized, individual utility engineered solely to optimize my own daily workflow, eliminate manual bottlenecks, and prevent data entry errors. This is an independent, personal initiative and is **not** an officially approved, team-wide, or enterprise-level deployment.

## Architectural Purpose

This project is an offline-capable browser-based utility belt built on a strict **Shell Architecture** that runs pure ES6+ JavaScript completely client-side. The goal is to provide a zero-latency omnichannel experience by avoiding external dependency chains or slow build-steps for production execution.

## Boot & Testing Sequence

To ensure the integrity of the tool, strict linting and tests are required.

To run the full suite:

1. `npm ci`
2. `npx --yes eslint .`
3. `npx --yes markdownlint-cli "**/*.md" --ignore node_modules`
4. `npm run test`
5. `npm run test:coverage`
6. `npm run test:e2e`

# ⚡ Sidebar Productivity Suite

## Project Title & Brief Description

**Sidebar Productivity Suite** is a localized Microsoft Edge Sidebar web app that I developed specifically to centralize and accelerate my own daily workflow. It provides instant, sandboxed access to essential utilities—including a scratchpad, calculation engine, local reference lookup, email template generator, and secure password generator—directly within my browser's sidebar.

## The Operational Bottleneck

I built this tool to eliminate the heavy manual processing, constant context-switching, and data entry risks associated with juggling multiple tabs and disconnected applications during my shifts. It specifically resolves the bottleneck of multi-domain sync delays and scattered information by providing a unified, offline-capable interface for all my repetitive daily tasks.

## Tech Stack & Architecture

* **Core Languages:** Native ES6+ JavaScript, HTML5, CSS Variables
* **Architecture:** Zero-build Shell Architecture (no bundlers, no backend)
* **Execution:** Pure client-side execution utilizing `iframes` for sandboxing
* **State Management:** Aggressive data persistence using browser `localStorage`
* **Testing:** Natively verified via Vitest

## Key Features & Workflow

* **Dashboard:** A central command interface that manages active tools and maintains persistent, multi-note scratchpads.
* **Calculator (Shift Pacing Engine):** Tracks my real-time progress against grade boundaries and provides actionable "Quick Fix" suggestions to optimize my daily metrics.
* **Lookup (Reference Database):** Executes instant keyword searches using a hybrid, async-optimized client-side index of flat-file local records.
* **MailTo (Template Generator):** Recursively builds nested email templates and offloads complex `.msg` binary parsing to a dedicated web worker, keeping the main thread completely responsive.
* **Passwords (Passphrase Generator):** Generates cryptographically secure, context-aware passphrases by intelligently mapping temporal offsets to dynamic seasonal word banks.

## Localized Impact

By centralizing these utilities into a single, accessible sidebar, this tool has dramatically reduced my daily context-switching overhead and completely eliminated routine manual data entry errors in my workflow. It has streamlined my daily email drafting and access management, ultimately saving me significant time, reducing cognitive load, and optimizing my shift pacing every single day.

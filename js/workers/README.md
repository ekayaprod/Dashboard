# MailTo Background Workers

## Overview

The `js/workers/` directory contains the background processing modules for the MailTo application. It is strictly dedicated to parsing Outlook `.msg` files and extracting email metadata (Subject, Body, Recipients) without blocking the main UI thread.

This worker implementation ensures that heavy binary parsing operations, which could otherwise freeze the main browser thread during large file uploads, are safely isolated.

## Execution Architecture

1. **Main Thread (`mailto.js`)**:
   The user drops a `.msg` file into the MailTo application. The file is read as an `ArrayBuffer` and sent to the worker via `postMessage()`. To maximize performance, the buffer is transferred using zero-copy transferables.
2. **Worker Thread (`msg-worker.js`)**:
   The worker receives the binary payload and acts as the execution wrapper. It instantiates the parser, validates the payload, and executes the extraction.
3. **Parser Engine (`msgreader.js`)**:
   The core OLE (Object Linking and Embedding) parser logic. It deeply traverses the binary structure of the `.msg` file, decodes the text streams (handling MAPI properties), and normalizes the output.
4. **Data Sanitization**:
   Before returning data to the main thread, `msg-worker.js` sanitizes the output by stripping non-clonable elements (like internal functions) to satisfy the structured clone algorithm.

## Files

* **`msgreader.js`**: The core binary parser module. Exporting `MsgReader`, which handles the low-level decoding of `.msg` arrays.
* **`msg-worker.js`**: The actual Web Worker script. It imports `MsgReader`, handles `onmessage` events from the main thread, and `postMessage`s the sanitized results back.

## Usage Blueprint

Do not import `msgreader.js` directly into the main thread. Always communicate via the worker:

```javascript
// Main Thread Example
const worker = new Worker('js/workers/msg-worker.js', { type: 'module' });

worker.onmessage = (e) => {
    if (e.data.success) {
        const { subject, body, recipients } = e.data.data;
        // Update UI
    }
};

// Transfer buffer to worker
const buffer = await file.arrayBuffer();
worker.postMessage(buffer, [buffer]);
```

/**
 * msg-worker.js
 * Web Worker for offloading binary .msg parsing.
 * @see README.md#Execution-Architecture for the full background parsing lifecycle.
 */
import { MsgReader } from './msgreader.js';

/**
 * Handles incoming ArrayBuffer messages from the main thread, parses the .msg file,
 * and posts the sanitized result back.
 * @param {MessageEvent<ArrayBuffer>} e - The message event containing the file buffer.
 */
self.onmessage = function(e) {
    try {
        const buffer = e.data;
        // Basic validation
        if (!buffer || !(buffer instanceof ArrayBuffer)) {
             throw new Error("Invalid input: Expected ArrayBuffer");
        }

        // Heavy lifting: Parse the buffer
        const rawResult = MsgReader.read(buffer);

        // Sanitize: Strip functions (getFieldValue) to ensure clonability
        const cleanResult = {
            subject: rawResult.subject,
            body: rawResult.body,
            bodyHTML: rawResult.bodyHTML,
            recipients: rawResult.recipients ? rawResult.recipients.map(r => ({
                name: r.name,
                email: r.email,
                recipientType: r.recipientType
            })) : []
        };

        self.postMessage({ success: true, data: cleanResult });
    } catch (err) {
        console.error("Worker Error:", err);
        self.postMessage({ success: false, error: err.message || "Unknown worker error" });
    }
};

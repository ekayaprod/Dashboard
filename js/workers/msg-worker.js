import { MsgReader } from './msgreader.js';

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

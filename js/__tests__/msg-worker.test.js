import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../workers/msg-reader.js', () => {
    return {
        MsgReader: {
            read: vi.fn((buffer) => {
                if (buffer.byteLength === 0) throw new Error("Empty buffer");
                return {
                    subject: "Test Subject",
                    body: "Test Body",
                    bodyHTML: "<p>Test Body</p>",
                    recipients: [{ name: "Test", email: "test@example.com", recipientType: "to" }]
                };
            })
        }
    };
});

describe('js/workers/msg-worker.js', () => {
    let mockPostMessage;
    let MsgReaderMock;

    beforeEach(async () => {
        mockPostMessage = vi.fn();

        // Mock self environment for worker
        globalThis.self = {
            postMessage: mockPostMessage
        };

        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Use a static import, resetModules handles cache clearance in vitest
        vi.resetModules();
        await import('../workers/msg-worker.js');

        const { MsgReader } = await import('../workers/msg-reader.js');
        MsgReaderMock = MsgReader;
        MsgReaderMock.read.mockClear();
    });

    it('should process a valid ArrayBuffer successfully', () => {
        const buffer = new ArrayBuffer(8);
        globalThis.self.onmessage({ data: buffer });

        expect(MsgReaderMock.read).toHaveBeenCalledWith(buffer);
        expect(mockPostMessage).toHaveBeenCalledWith({
            success: true,
            data: {
                subject: "Test Subject",
                body: "Test Body",
                bodyHTML: "<p>Test Body</p>",
                recipients: [{ name: "Test", email: "test@example.com", recipientType: "to" }]
            }
        });
    });

    it('should return error for invalid input type', () => {
        globalThis.self.onmessage({ data: "not a buffer" });
        expect(mockPostMessage).toHaveBeenCalledWith({
            success: false,
            error: "Invalid input: Expected ArrayBuffer"
        });
    });

    it('should catch parsing errors and return them', () => {
        const buffer = new ArrayBuffer(0); // Trigger mock error
        globalThis.self.onmessage({ data: buffer });
        expect(mockPostMessage).toHaveBeenCalledWith({
            success: false,
            error: "Empty buffer"
        });
    });
});

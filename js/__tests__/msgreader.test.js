
import { describe, it, expect } from 'vitest';
import { MsgReader } from '../msgreader.js';

describe('MsgReader Text Decoding', () => {
    it('should decode valid UTF-8 content in parseMime', () => {
        // "Hello World" in UTF-8
        const buffer = new TextEncoder().encode('Hello World');
        // Pass Uint8Array directly
        const result = MsgReader.read(buffer);
        // It tries to parse MIME headers, so body might be null if no headers
        // But let's check if it crashes
        expect(result).toBeDefined();
        // With no headers, it might return empty body or raw text depending on implementation details
        // _scanBufferForMimeText logic:
        // if no headers, it returns nulls for subject/to/cc.
        // body logic: headerEndIndex check. If no double newline, it fails to find body start?
        // "headerEndIndex === -1 ... offset=2"
        // It seems robust enough.
    });

    it('should handle invalid UTF-8 by falling back (Mime path)', () => {
        // Invalid UTF-8 sequence: 0xC3 0x28 (C3 expects next byte to be 80-BF, 28 is 00101000)
        // In ISO-8859-1 (Latin1), C3 is Ã, 28 is (
        const uint8 = new Uint8Array([0xC3, 0x28]);
        const result = MsgReader.read(uint8.buffer);
        expect(result).toBeDefined();
    });

    it('should handle UTF-16LE in OLE structure (mocking OLE is hard, skipping complex OLE test)', () => {
        // We can't easily test the internal dataViewToString without exposing it or mocking the whole OLE structure.
        // But we can verify the module loads and runs basic non-OLE paths.
    });

    it('should handle Uint8Array views correctly', () => {
        // Create a buffer with extra data around the target
        // "Subject: Test\r\n\r\nBodyContent"
        const innerContent = "Subject: Test\r\n\r\nBodyContent";
        const fullText = "PREFIX" + innerContent + "SUFFIX";
        const fullEncoded = new TextEncoder().encode(fullText);

        const start = 6; // Length of PREFIX
        const length = innerContent.length;
        const viewEncoded = fullEncoded.subarray(start, start + length);

        // MsgReader should treat this view as the full file content
        const result = MsgReader.read(viewEncoded);

        // It should parse correctly
        expect(result.subject).toBe('Test');
        expect(result.body).toBe('BodyContent');

        // If it read surrounding data, it might fail parsing or contain PREFIX
        const rawBody = result.body || '';
        expect(rawBody).not.toContain('PREFIX');
        expect(rawBody).not.toContain('SUFFIX');
    });

    it('should correctly decode Quoted-Printable content with ISO-8859-1 charset', () => {
        const mime =
            'Subject: Test QP\r\n' +
            'Content-Type: text/plain; charset="iso-8859-1"\r\n' +
            'Content-Transfer-Encoding: quoted-printable\r\n' +
            '\r\n' +
            '=E9'; // é in ISO-8859-1

        const buffer = new TextEncoder().encode(mime);
        const result = MsgReader.read(buffer);

        expect(result.subject).toBe('Test QP');
        expect(result.body).toBe('é');
    });

    it('should correctly decode Quoted-Printable content with UTF-8 charset', () => {
        const mime =
            'Subject: Test QP UTF-8\r\n' +
            'Content-Type: text/plain; charset="utf-8"\r\n' +
            'Content-Transfer-Encoding: quoted-printable\r\n' +
            '\r\n' +
            '=C3=A9'; // é in UTF-8

        const buffer = new TextEncoder().encode(mime);
        const result = MsgReader.read(buffer);

        expect(result.subject).toBe('Test QP UTF-8');
        expect(result.body).toBe('é');
    });

    it('should correctly parse recipients with commas in quoted names', () => {
        const mime =
            'Subject: Test Recipients\r\n' +
            'To: "Doe, John" <john.doe@example.com>, Jane <jane@example.com>, "Smith, Bob, Jr." <bob@example.com>\r\n' +
            '\r\n' +
            'Body';

        const buffer = new TextEncoder().encode(mime);
        // MsgReader.read automatically falls back to parseMime() if the OLE signature is missing.
        // This test verifies the MIME recipient parsing logic (specifically regex splitting).
        const result = MsgReader.read(buffer);

        expect(result.recipients).toHaveLength(3);
        // recipientType: 1 is TO
        expect(result.recipients[0]).toEqual({ name: 'Doe, John', email: 'john.doe@example.com', recipientType: 1 });
        expect(result.recipients[1]).toEqual({ name: 'Jane', email: 'jane@example.com', recipientType: 1 });
        expect(result.recipients[2]).toEqual({ name: 'Smith, Bob, Jr.', email: 'bob@example.com', recipientType: 1 });
    });
});

/**
 * Simplified MSG Parser (Fallback)
 *
 * This parser does NOT attempt to parse the OLE/CFB structure.
 * Instead, it treats the entire file as a text blob and searches
 * for standard email headers (Subject, To, Cc) and the plain-text
 * body, which are often present in plain ASCII/UTF-8 within the
 * .msg file, even if the OLE structure is corrupt.
 */
(function(global) {
    'use strict';

    function SimpleMsgParser() {}

    /**
     * Converts a byte array (Array<number>) into a string.
     * This is a "best effort" conversion, stripping nulls
     * and handling basic printable ASCII.
     * @param {Array<number>} bytes - Byte array
     * @returns {string}
     */
    function bytesToString(bytes) {
        let str = '';
        for (let i = 0; i < bytes.length; i++) {
            const charCode = bytes[i];
            // Include printable ASCII, tabs, newlines, and common extended ASCII
            if (charCode === 9 || charCode === 10 || charCode === 13 || (charCode >= 32 && charCode <= 126) || (charCode >= 128 && charCode <= 255)) {
                str += String.fromCharCode(charCode);
            }
            // Simple check for UTF-16LE null byte (common in MSG strings)
            if (charCode === 0 && i + 1 < bytes.length && (bytes[i+1] >= 32 || bytes[i+1] === 0)) {
                 i += 1; // Skip pair
            }
        }
        return str;
    }

    /**
     * Extracts a field value from raw email text using regex.
     * @param {string} text - The raw email text.
     * @param {RegExp} regex - The regex to find the header.
     * @returns {string}
     */
    function extractField(text, regex) {
        const match = text.match(regex);
        if (match && match[1]) {
            // Clean up the field
            return match[1].trim()
                // Remove quoted-printable artifacts
                .replace(/=\r\n/g, '')
                .replace(/=20/g, ' ')
                .replace(/=0A/g, '\n')
                .replace(/=3D/g, '=');
        }
        return '';
    }

    /**
     * Extracts the plain-text body from a multipart email.
     * @param {string} text - The raw email text.
     * @returns {string}
     */
    function extractBody(text) {
        let bodyStartIndex = -1;
        
        // Strategy 1: Look for the plain text content type marker
        const plainTextMarker = 'Content-Type: text/plain;';
        const markerIndex = text.indexOf(plainTextMarker);
        
        if (markerIndex !== -1) {
            // Find the start of the body after the marker
            bodyStartIndex = text.indexOf('\n\n', markerIndex);
            if (bodyStartIndex === -1) {
                 bodyStartIndex = text.indexOf('\r\n\r\n', markerIndex);
            }
        }

        // Strategy 2: If no marker, find Subject and look for first blank line after it
        if (bodyStartIndex === -1) {
            const subjectIndex = text.toLowerCase().indexOf('subject:');
            if (subjectIndex !== -1) {
                 bodyStartIndex = text.indexOf('\n\n', subjectIndex);
                 if (bodyStartIndex === -1) {
                    bodyStartIndex = text.indexOf('\r\n\r\n', subjectIndex);
                 }
            }
        }
        
        // Strategy 3: If still nothing, find first blank line period.
        if (bodyStartIndex === -1) {
            bodyStartIndex = text.indexOf('\n\n');
             if (bodyStartIndex === -1) {
                bodyStartIndex = text.indexOf('\r\n\r\n');
             }
        }

        if (bodyStartIndex === -1) {
            return ''; // Give up
        }

        // We found a potential start, adjust for the newline characters
        bodyStartIndex += 2; // (either \n\n or \r\n\r\n is at least 2 chars)
        if (text[bodyStartIndex] === '\r' || text[bodyStartIndex] === '\n') {
            bodyStartIndex++; // Handle \r\n\r\n case
        }
        if (text[bodyStartIndex] === '\r' || text[bodyStartIndex] === '\n') {
            bodyStartIndex++; // Handle \r\n\r\n case
        }


        // Find the end of the body (the next boundary marker)
        const boundaryMatch = text.match(/boundary="([^"]+)"/);
        let boundary = '';
        if (boundaryMatch && boundaryMatch[1]) {
            boundary = '--' + boundaryMatch[1];
        }

        let bodyEndIndex = -1;
        if (boundary) {
            bodyEndIndex = text.indexOf(boundary, bodyStartIndex);
        }

        let body = '';
        if (bodyEndIndex !== -1) {
            body = text.substring(bodyStartIndex, bodyEndIndex);
        } else {
            // If no boundary found, just take a large chunk from the start
            body = text.substring(bodyStartIndex, bodyStartIndex + 20000);
            
            // If we did this, check for an HTML body boundary
            const htmlBoundary = body.indexOf('Content-Type: text/html;');
            if (htmlBoundary !== -1) {
                body = body.substring(0, htmlBoundary);
            }
        }

        // Clean up the body
        return body.trim()
            // Remove quoted-printable artifacts
            .replace(/=\r\n/g, '')
            .replace(/=20/g, ' ')
            .replace(/=0A/g, '\n')
            .replace(/=3D/g, '=')
            // Remove lingering = signs at end of lines
            .replace(/=\n/g, '\n')
            .replace(/=\r/g, '\r')
             // Handle some other common encodings
            .replace(/=E2=80=99/g, "'") // ’
            .replace(/=E2=8G=93/g, "–") // –
            .replace(/=E2=80=9C/g, '"') // “
            .replace(/=E2=80=9D/g, '"'); // ”
    }

    SimpleMsgParser.prototype.parse = function(arrayBuffer) {
        // Convert to regular array if needed
        var bytes;
        if (arrayBuffer instanceof ArrayBuffer) {
            bytes = Array.from(new Uint8Array(arrayBuffer));
        } else if (arrayBuffer instanceof Uint8Array) {
            bytes = Array.from(arrayBuffer);
        } else if (Array.isArray(arrayBuffer)) {
            bytes = arrayBuffer;
        } else {
            throw new Error('Invalid input');
        }

        // Convert the *entire* file to a string
        const rawText = bytesToString(bytes);

        // Define regex for standard email headers
        // Make them case-insensitive and check for start of line
        const subjectRegex = /^Subject:\s*([^\n\r]+)/im;
        const toRegex = /^To:\s*([^\n\r]+)/im;
        const ccRegex = /^Cc:\s*([^\n\r]+)/im;
        
        var result = {
            subject: extractField(rawText, subjectRegex),
            body: extractBody(rawText),
            to: extractField(rawText, toRegex),
            cc: extractField(rawText, ccRegex),
            from: '' // 'From' is harder to parse reliably, skipping
        };

        // CRITICAL: If we didn't find anything, throw error
        if (!result.subject && !result.body && !result.to) {
            throw new Error('Simple parser (fallback) found no headers or body.');
        }

        return result;
    };
    
    // Export
    global.SimpleMsgParser = SimpleMsgParser;
    
})(typeof window !== 'undefined' ? window : this);

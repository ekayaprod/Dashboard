/**
     * NEW HELPER (FIX 2)
     * Scans the raw file buffer for plain-text MIME headers.
     * This is a fallback for O365 files that store data as text instead of in OLE streams.
     */
    MsgReader.prototype._scanBufferForMimeText = function() {
        if (this._mimeScanCache) {
            return this._mimeScanCache;
        }

        console.log('Scanning raw buffer for MIME text fallback...');
        var rawText = '';
        try {
            // Try UTF-8 first
            rawText = new TextDecoder('utf-8', { fatal: false }).decode(this.dataView);
        } catch (e) {
            // Fallback to latin1 (which handles arbitrary bytes)
            try {
                rawText = new TextDecoder('latin1').decode(this.dataView);
            } catch (e2) {
                console.warn('Could not decode raw buffer for MIME scan.');
                return { subject: null, to: null, cc: null, body: null };
            }
        }

        var result = {
            subject: null,
            to: null,
            cc: null,
            body: null
        };

        // FIX: More flexible regex patterns that handle multi-line headers and various formats
        // Look for headers that might span multiple lines or have different separators
        var subjectMatch = rawText.match(/\bSubject:\s*([^\r\n]+)/i);
        if (subjectMatch) {
            result.subject = subjectMatch[1].trim();
            console.log('MIME Fallback found Subject:', result.subject);
        }

        // FIX: More flexible To: pattern - look for email addresses after "To:"
        var toMatch = rawText.match(/\bTo:\s*([^\r\n]+)/i);
        if (toMatch) {
            result.to = toMatch[1].trim();
            console.log('MIME Fallback found To:', result.to);
        }

        // FIX: More flexible Cc: pattern
        var ccMatch = rawText.match(/\bCc:\s*([^\r\n]+)/i);
        if (ccMatch) {
            result.cc = ccMatch[1].trim();
            console.log('MIME Fallback found Cc:', result.cc);
        }
        
        // Find body: Look for the first double-linebreak after the headers
        var headerEndMatch = rawText.match(/(\r\n\r\n|\n\n)/);
        if (headerEndMatch) {
            var bodyText = rawText.substring(headerEndMatch.index + headerEndMatch[0].length);
            // Try to find the *plain text* body part
            var plainBodyMatch = bodyText.match(/Content-Type:\s*text\/plain;[\s\S]*?(\r\n\r\n|\n\n)([\s\S]*?)(--_?|\r\n\r\nContent-Type:)/im);
            
            if (plainBodyMatch && plainBodyMatch[2]) {
                result.body = plainBodyMatch[2].trim();
            } else {
                // If no plain text part, just take the first chunk
                result.body = bodyText.split(/--_?|\r\n\r\nContent-Type:/)[0].trim();
            }
            console.log('MIME Fallback found Body (first 50 chars):', result.body ? result.body.substring(0, 50) : 'null');
        }

        this._mimeScanCache = result;
        return result;
    };

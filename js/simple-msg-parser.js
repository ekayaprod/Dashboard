/**
 * Simplified MSG Parser
 * Only extracts basic email fields from MSG files
 */
(function(global) {
    'use strict';
    
    function SimpleMsgParser() {}
    
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
        
        // Basic validation
        if (bytes.length < 512) {
            throw new Error('File too small');
        }
        
        // Check OLE signature
        var sig = String.fromCharCode.apply(null, bytes.slice(0, 8));
        if (sig !== '\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1') {
            throw new Error('Invalid MSG file signature');
        }
        
        // Search for common MAPI property strings in the file
        // Note: This is a brute-force method and may not be 100% reliable
        // We are searching for the *stream names* which are stored as Unicode.
        var result = {
            subject: this.extractField(bytes, '__substg1.0_0037'),
            body: this.extractField(bytes, '__substg1.0_1000'),
            to: this.extractField(bytes, '__substg1.0_0E04'), // PR_DISPLAY_TO
            cc: this.extractField(bytes, '__substg1.0_0E03'), // PR_DISPLAY_CC
            from: this.extractField(bytes, '__substg1.0_0C1A') // PR_SENDER_NAME
        };
        
        // If a field is empty, try an alternative property
        if (!result.to) {
            result.to = this.extractField(bytes, '__substg1.0_3001'); // PR_RECIPIENT_DISPLAY_NAME (often in recipients)
        }
         if (!result.from) {
            result.from = this.extractField(bytes, '__substg1.0_0C1E'); // PR_SENDER_EMAIL_ADDRESS
        }

        return result;
    };
    
    /**
     * Finds a Unicode (UTF-16LE) string marker in the byte array and
     * attempts to extract a nearby data string. This is a highly
     * experimental and fragile method.
     */
    SimpleMsgParser.prototype.extractField = function(bytes, marker) {
        // Find the marker string in the byte array (as UTF-16LE)
        var markerBytes = [];
        for (var i = 0; i < marker.length; i++) {
            markerBytes.push(marker.charCodeAt(i) & 0xFF);
            markerBytes.push(0x00); // Unicode null
        }
        
        // Search for marker
        var index = this.findSequence(bytes, markerBytes);
        if (index === -1) {
            return '';
        }

        // This is heuristic: We assume the data is *somewhere* after the marker
        // Let's search for a long-ish sequence of printable chars after it
        var start = index + markerBytes.length;
        var maxLength = 10000; // Reasonable limit
        var result = '';
        
        // We are looking for the *data* stream, which might be near the *name* stream
        // This simple parser is very limited. It will likely find the stream *name*
        // but not its *content*.
        
        // A better simple approach: find the *marker*, then look backwards
        // for the 128-byte directory entry, get the stream start sector and size.
        // That is too complex for this simple parser.
        
        // A *simpler* approach: just find printable strings near the marker
        // This might find the subject/to in the directory entry itself
        var searchStart = index + 64; // Look around the directory entry
        var bestCandidate = '';

        for (var i = searchStart; i < Math.min(searchStart + 2048, bytes.length - 1); i += 2) {
            var charCode = bytes[i] | (bytes[i + 1] << 8);
            if (charCode === 0) {
                if (result.length > bestCandidate.length) {
                    bestCandidate = result;
                }
                if (bestCandidate.length > 5) break; // Good enough
                result = '';
                continue;
            }
            if (charCode >= 32 && charCode <= 0x7F) { // Printable ASCII
                 result += String.fromCharCode(charCode);
            } else if (charCode > 0x7F) {
                 // Probably unicode, but let's stick to ASCII for this simple parser
                 result += String.fromCharCode(charCode); // Try anyway
            } else {
                // Control char, reset
                if (result.length > bestCandidate.length) {
                    bestCandidate = result;
                }
                result = '';
            }
        }
        
        return bestCandidate.trim();
    };
    
    SimpleMsgParser.prototype.findSequence = function(bytes, sequence) {
        for (var i = 0; i < bytes.length - sequence.length; i++) {
            var found = true;
            for (var j = 0; j < sequence.length; j++) {
                if (bytes[i + j] !== sequence[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return i;
        }
        return -1;
    };
    
    // Export
    global.SimpleMsgParser = SimpleMsgParser;
    
})(typeof window !== 'undefined' ? window : this);

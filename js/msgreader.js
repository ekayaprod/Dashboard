/**
 * msg-reader.js v1.4.4
 * Production-grade Microsoft Outlook MSG and OFT file parser
 * Compatible with Outlook 365 and modern MSG formats
 * * Based on msg.reader by Peter Theill
 * Licensed under MIT
 *
 * CHANGELOG (v1.4.4):
 * 1. [FIX] Re-ordered recipient extraction fallbacks.
 * - Method 3 (MIME Scan) now runs BEFORE Method 2 (Display Fields).
 * - This prioritizes the correct MIME headers (To:, Cc:) found in
 * raw text over the potentially corrupt OLE properties
 * (PROP_ID_DISPLAY_TO, PROP_ID_DISPLAY_CC) in hybrid files.
 * - This fixes the "CC data in TO field" bug.
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MsgReader = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // Property types
    var PROP_TYPE_INTEGER32 = 0x0003;
    var PROP_TYPE_BOOLEAN = 0x000B;
    var PROP_TYPE_STRING = 0x001E; // String8 (ASCII/UTF-8)
    var PROP_TYPE_STRING8 = 0x001F; // Unicode (UTF-16LE)
    var PROP_TYPE_TIME = 0x0040;
    var PROP_TYPE_BINARY = 0x0102;

    // Property IDs we care about for mailto
    var PROP_ID_SUBJECT = 0x0037;
    var PROP_ID_BODY = 0x1000;
    var PROP_ID_HTML_BODY = 0x1013;
    var PROP_ID_SENDER_NAME = 0x0C1A;
    var PROP_ID_SENDER_EMAIL = 0x5D01; // SMTP address
    var PROP_ID_DISPLAY_TO = 0x0E04;
    var PROP_ID_DISPLAY_CC = 0x0E03;
    var PROP_ID_DISPLAY_BCC = 0x0E02;

    // Recipient Property IDs
    var PROP_ID_RECIPIENT_TYPE = 0x0C15;
    var PROP_ID_RECIPIENT_DISPLAY_NAME = 0x3001;
    var PROP_ID_RECIPIENT_EMAIL_ADDRESS = 0x3003;
    var PROP_ID_RECIPIENT_SMTP_ADDRESS = 0x39FE;


    // Recipient types
    var RECIPIENT_TYPE_TO = 1;
    var RECIPIENT_TYPE_CC = 2;
    var RECIPIENT_TYPE_BCC = 3;

    /**
     * Helper: Convert DataView to string
     */
    function dataViewToString(view, encoding) {
        var result = '';
        var length = view.byteLength;
        
        if (encoding === 'utf16le') {
            for (var i = 0; i < length; i += 2) {
                if (i + 1 < length) {
                    var charCode = view.getUint16(i, true);
                    if (charCode === 0) break;
                    result += String.fromCharCode(charCode);
                }
            }
        } else if (encoding === 'utf-8') {
             // Basic UTF-8 decoder
            try {
                // Use TextDecoder if available (modern browsers)
                if (typeof TextDecoder !== 'undefined') {
                    var decoded = new TextDecoder('utf-8', { fatal: false }).decode(view);
                    // Remove null terminators
                    const nullIdx = decoded.indexOf('\0');
                    if (nullIdx !== -1) {
                        return decoded.substring(0, nullIdx);
                    }
                    return decoded;
                }
                // Fallback for older environments
                var bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
                var str = '';
                for (var i = 0; i < bytes.length; i++) {
                    var charCode = bytes[i];
                    if (charCode === 0) break; // Null terminator
                    if (charCode < 0x80) {
                        str += String.fromCharCode(charCode);
                    } else if (charCode < 0xE0) {
                        str += String.fromCharCode(((charCode & 0x1F) << 6) | (bytes[++i] & 0x3F));
                    } else if (charCode < 0xF0) {
                        str += String.fromCharCode(((charCode & 0x0F) << 12) | ((bytes[++i] & 0x3F) << 6) | (bytes[++i] & 0x3F));
                    } else {
                        var codePoint = ((charCode & 0x07) << 18) | ((bytes[++i] & 0x3F) << 12) | ((bytes[++i] & 0x3F) << 6) | (bytes[++i] & 0x3F);
                        codePoint -= 0x10000;
                        str += String.fromCharCode(0xD800 + (codePoint >> 10), 0xDC00 + (codePoint & 0x3FF));
                    }
                }
                return str;
            } catch (e) {
                console.warn('UTF-8 decode failed, falling back to ASCII');
                return dataViewToString(view, 'ascii'); // Fallback
            }
        } else {
            // ASCII (default)
            for (var i = 0; i < length; i++) {
                var charCode = view.getUint8(i);
                if (charCode === 0) break;
                // Only allow printable ASCII + common whitespace
                if (charCode === 9 || charCode === 10 || charCode === 13 || (charCode >= 32 && charCode <= 126)) {
                    result += String.fromCharCode(charCode);
                }
            }
        }
        
        return result;
    }

    /**
     * Helper: Convert FILETIME to JavaScript Date
     */
    function filetimeToDate(low, high) {
        var FILETIME_EPOCH_DIFF = 116444736000000000n;
        var TICKS_PER_MILLISECOND = 10000n;
        
        try {
            var filetime = (BigInt(high) << 32n) | BigInt(low);
            var milliseconds = (filetime - FILETIME_EPOCH_DIFF) / TICKS_PER_MILLISECOND;
            return new Date(Number(milliseconds));
        } catch (e) {
            console.warn('Failed to parse date:', e);
            return null;
        }
    }

    /**
     * Main MSG Reader Class
     */
    function MsgReader(arrayBuffer) {
        this.buffer = null;
        this.dataView = null;
        
        if (arrayBuffer instanceof ArrayBuffer) {
            this.buffer = arrayBuffer;
        } else if (arrayBuffer instanceof Uint8Array) {
            this.buffer = arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
        } else if (Array.isArray(arrayBuffer)) {
            this.buffer = new Uint8Array(arrayBuffer).buffer;
        } else {
            throw new Error('Invalid input: expected ArrayBuffer, Uint8Array, or Array');
        }
        
        this.dataView = new DataView(this.buffer);
        this.header = null;
        this.fat = null;
        this.miniFat = null;
        this.directoryEntries = [];
        this.properties = {};
        this._mimeScanCache = null; // Cache for the raw text scan
    }

    MsgReader.prototype.parse = function() {
        try {
            this.readHeader();
            this.readFAT();
            this.readMiniFAT();
            this.readDirectory();
            this.extractProperties();
            
            return {
                getFieldValue: this.getFieldValue.bind(this),
                subject: this.getFieldValue('subject'),
                body: this.getFieldValue('body'),
                bodyHTML: this.getFieldValue('bodyHTML'),
                senderName: this.getFieldValue('senderName'),
                senderEmail: this.getFieldValue('senderEmail'),
                recipients: this.getFieldValue('recipients')
            };
        } catch (e) {
            console.error('MSG parsing error:', e);
            throw new Error('Failed to parse MSG file: ' + e.message);
        }
    };

    MsgReader.prototype.readHeader = function() {
        // Validate file size
        if (this.buffer.byteLength < 512) {
            throw new Error('File too small to be valid MSG file');
        }

        // Check signature
        var sig1 = this.dataView.getUint32(0, true);
        var sig2 = this.dataView.getUint32(4, true);
        
        if (sig1 !== 0xE011CFD0 || sig2 !== 0xE11AB1A1) {
            throw new Error('Invalid MSG file signature');
        }

        this.header = {
            sectorShift: this.dataView.getUint16(30, true),
            miniSectorShift: this.dataView.getUint16(32, true),
            totalSectors: this.dataView.getUint32(40, true),
            fatSectors: this.dataView.getUint32(44, true),
            directoryFirstSector: this.dataView.getUint32(48, true),
            miniFatFirstSector: this.dataView.getUint32(60, true),
            miniFatTotalSectors: this.dataView.getUint32(64, true),
            difFirstSector: this.dataView.getUint32(68, true),
            difTotalSectors: this.dataView.getUint32(72, true)
        };

        this.header.sectorSize = Math.pow(2, this.header.sectorShift);
        this.header.miniSectorSize = Math.pow(2, this.header.miniSectorShift);

        console.log('MSG Header:', this.header);
    };

    MsgReader.prototype.readFAT = function() {
        var sectorSize = this.header.sectorSize;
        var entriesPerSector = sectorSize / 4;
        this.fat = [];

        // Read FAT sectors from header
        var fatSectorPositions = [];
        for (var i = 0; i < 109 && i < this.header.fatSectors; i++) {
            var sectorNum = this.dataView.getUint32(76 + i * 4, true);
            if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF) {
                fatSectorPositions.push(sectorNum);
            }
        }
        
        // Read DIF sectors if present
        if (this.header.difTotalSectors > 0) {
            var difSector = this.header.difFirstSector;
            var difSectorsRead = 0;
            while(difSector !== 0xFFFFFFFE && difSector !== 0xFFFFFFFF && difSectorsRead < this.header.difTotalSectors) {
                var difOffset = 512 + difSector * sectorSize;
                // Read up to (entriesPerSector - 1) sector positions
                for (var j = 0; j < entriesPerSector - 1; j++) {
                    var sectorNum = this.dataView.getUint32(difOffset + j * 4, true);
                    if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF) {
                        fatSectorPositions.push(sectorNum);
                    }
                }
                // Last int is the next DIF sector
                difSector = this.dataView.getUint32(difOffset + (entriesPerSector - 1) * 4, true);
                difSectorsRead++;
            }
        }


        // Read FAT entries
        for (var i = 0; i < fatSectorPositions.length; i++) {
            var sectorOffset = 512 + fatSectorPositions[i] * sectorSize;
            
            for (var j = 0; j < entriesPerSector; j++) {
                var offset = sectorOffset + j * 4;
                if (offset + 4 <= this.buffer.byteLength) {
                    this.fat.push(this.dataView.getUint32(offset, true));
                }
            }
        }

        console.log('FAT entries:', this.fat.length);
    };

    MsgReader.prototype.readMiniFAT = function() {
        if (this.header.miniFatFirstSector === 0xFFFFFFFE || 
            this.header.miniFatFirstSector === 0xFFFFFFFF) {
            this.miniFat = [];
            return;
        }

        this.miniFat = [];
        var sector = this.header.miniFatFirstSector;
        var sectorSize = this.header.sectorSize;
        var entriesPerSector = sectorSize / 4;
        var sectorsRead = 0;

        while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sectorsRead < this.header.miniFatTotalSectors) {
            var sectorOffset = 512 + sector * sectorSize;
            
            for (var i = 0; i < entriesPerSector; i++) {
                var offset = sectorOffset + i * 4;
                if (offset + 4 <= this.buffer.byteLength) {
                    this.miniFat.push(this.dataView.getUint32(offset, true));
                }
            }

            if (sector >= this.fat.length) {
                 console.warn('MiniFAT sector chain error: sector index out of bounds.');
                 break;
            }
            sector = this.fat[sector];
            sectorsRead++;
        }

        console.log('MiniFAT entries:', this.miniFat.length);
    };

    MsgReader.prototype.readDirectory = function() {
        var sector = this.header.directoryFirstSector;
        var sectorSize = this.header.sectorSize;
        var entrySize = 128;
        var entriesPerSector = sectorSize / entrySize;
        var sectorsRead = 0;

        while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sectorsRead < 1000) {
            var sectorOffset = 512 + sector * sectorSize;

            for (var i = 0; i < entriesPerSector; i++) {
                var entryOffset = sectorOffset + i * entrySize;
                
                if (entryOffset + entrySize > this.buffer.byteLength) {
                    break;
                }

                var entry = this.readDirectoryEntry(entryOffset);
                if (entry && entry.name) {
                    this.directoryEntries.push(entry);
                }
            }
            
            if (sector >= this.fat.length) {
                 console.warn('Directory sector chain error: sector index out of bounds.');
                 break;
            }
            sector = this.fat[sector];
            sectorsRead++;
        }

        console.log('Directory entries:', this.directoryEntries.length);
        
        //
        // START PATCH 1
        //
        // after directoryEntries built
        this.directoryEntries.forEach((de, idx) => de.id = idx);
        //
        // END PATCH 1
        //
        
        //
        // START PATCH 2: DIAGNOSTIC
        //
        // DIAGNOSTIC: show directory entries with index and name
        this.directoryEntries.forEach(function(de, idx){
            try {
                console.log('DIR[' + idx + ']:', { index: idx, name: de.name, type: de.type, startSector: de.startSector, size: de.size, childId: de.childId, leftSiblingId: de.leftSiblingId, rightSiblingId: de.rightSiblingId });
            } catch(e){}
        });
        //
        // END PATCH 2
        //
    };

    MsgReader.prototype.readDirectoryEntry = function(offset) {
        // Read name (64 bytes, UTF-16LE)
        var nameLength = this.dataView.getUint16(offset + 64, true);
        if (nameLength === 0 || nameLength > 64) {
            return null;
        }

        var nameView = new DataView(this.buffer, offset, Math.min(nameLength, 64));
        var name = dataViewToString(nameView, 'utf16le');

        var type = this.dataView.getUint8(offset + 66);
        
        // Skip invalid types
        if (type !== 1 && type !== 2 && type !== 5) {
            return null;
        }

        var startSector = this.dataView.getUint32(offset + 116, true);
        var size = this.dataView.getUint32(offset + 120, true);
        
        //
        // START PATCH 1
        //
        var leftSiblingId = this.dataView.getInt32(offset + 68, true);
        var rightSiblingId = this.dataView.getInt32(offset + 72, true);
        var childId = this.dataView.getInt32(offset + 76, true);
        //
        // END PATCH 1
        //

        return {
            name: name,
            type: type, // 1=storage, 2=stream, 5=root
            startSector: startSector,
            size: size,
            leftSiblingId: leftSiblingId,
            rightSiblingId: rightSiblingId,
            childId: childId,
            id: -1 // Will be assigned later
        };
    };

    MsgReader.prototype.readStream = function(entry) {
        if (!entry || entry.size === 0) {
            return new Uint8Array(0);
        }

        var data = new Uint8Array(entry.size);
        var dataOffset = 0;
        var sectorSize = this.header.sectorSize;
        var miniSectorSize = this.header.miniSectorSize;

        // Determine if we use FAT or MiniFAT
        var useMini = entry.size < 4096;

        if (useMini) {
            // Use MiniFAT
            var rootEntry = this.directoryEntries.find(function(e) { return e.type === 5; });
            if (!rootEntry) {
                console.warn('Root entry not found for MiniFAT stream');
                return new Uint8Array(0);
            }

            var miniStreamData = this.readStream(rootEntry);
            var sector = entry.startSector;
            var sectorsRead = 0;

            while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && 
                   dataOffset < entry.size && sectorsRead < 10000) {
                var miniOffset = sector * miniSectorSize;
                var bytesToCopy = Math.min(miniSectorSize, entry.size - dataOffset);

                for (var i = 0; i < bytesToCopy && miniOffset + i < miniStreamData.length; i++) {
                    data[dataOffset++] = miniStreamData[miniOffset + i];
                }

                if (sector >= this.miniFat.length) {
                    console.warn('MiniFAT sector chain error: sector index out of bounds.');
                    break;
                }
                sector = this.miniFat[sector];
                sectorsRead++;
            }
        } else {
            // Use FAT
            var sector = entry.startSector;
            var sectorsRead = 0;

            while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && 
                   dataOffset < entry.size && sectorsRead < 10000) {
                var sectorOffset = 512 + sector * sectorSize;
                var bytesToCopy = Math.min(sectorSize, entry.size - dataOffset);

                for (var i = 0; i < bytesToCopy && sectorOffset + i < this.buffer.byteLength; i++) {
                    data[dataOffset++] = this.dataView.getUint8(sectorOffset + i);
                }

                if (sector >= this.fat.length) {
                    console.warn('FAT sector chain error: sector index out of bounds.');
                    break;
                }
                sector = this.fat[sector];
                sectorsRead++;
            }
        }

        return data.slice(0, dataOffset);
    };

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

        // Regex to find headers. Multiline and case-insensitive.
        var subjectMatch = rawText.match(/^Subject:\s*(.*)/im);
        if (subjectMatch) {
            result.subject = subjectMatch[1].trim();
            console.log('MIME Fallback found Subject:', result.subject);
        }

        var toMatch = rawText.match(/^To:\s*(.*)/im);
        if (toMatch) {
            result.to = toMatch[1].trim();
            console.log('MIME Fallback found To:', result.to);
        }

        var ccMatch = rawText.match(/^Cc:\s*(.*)/im);
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


    MsgReader.prototype.extractProperties = function() {
        var self = this;
    
        console.log('Extracting properties from', this.directoryEntries.length, 'entries...');
    
        // Find property streams
        this.directoryEntries.forEach(function(entry) {
            // FIX: Check if it's a root property AND NOT a recipient property
            var isRootProperty = entry.name.indexOf('__substg1.0_') === 0;
            var isRecipientProperty = entry.name.indexOf('__recip_version1.0_') > -1;

            if (isRootProperty && !isRecipientProperty) { // Ensure it's not a recipient property
                var propTag = "00000000";
                 if (entry.name.length >= 20) {
                    propTag = entry.name.substring(entry.name.length - 8);
                 } else {
                    // Fallback for shorter names like "__substg1.0_0037001E"
                    var parts = entry.name.split('_');
                    if (parts.length >= 3) {
                        propTag = parts[2];
                    }
                 }

                var propId = parseInt(propTag.substring(0, 4), 16);
                var propType = parseInt(propTag.substring(4, 8), 16);
    
                var streamData = self.readStream(entry);
                var value = self.convertPropertyValue(streamData, propType, propId);
    
                console.log('Property', propId.toString(16), 'type', propType.toString(16), '=', 
                            typeof value === 'string' ? value.substring(0, 50) : (value instanceof Uint8Array ? "Uint8Array(" + value.length + ")" : value));
    
                self.properties[propId] = {
                    id: propId,
                    type: propType,
                    value: value
                };
            }
        });
        
        //
        // START ENHANCE (FIX 2): Fallback for empty OLE streams
        //
        var mimeData = this._scanBufferForMimeText();
        
        if (!this.properties[PROP_ID_SUBJECT] || !this.properties[PROP_ID_SUBJECT].value) {
            if (mimeData.subject) {
                 console.log('Applying MIME fallback for Subject');
                 this.properties[PROP_ID_SUBJECT] = { id: PROP_ID_SUBJECT, type: PROP_TYPE_STRING, value: mimeData.subject };
            }
        }
        if (!this.properties[PROP_ID_BODY] || !this.properties[PROP_ID_BODY].value) {
            if (mimeData.body) {
                console.log('Applying MIME fallback for Body');
                this.properties[PROP_ID_BODY] = { id: PROP_ID_BODY, type: PROP_TYPE_STRING, value: mimeData.body };
            }
        }
        //
        // END ENHANCE (FIX 2)
        //
    
        // Extract recipients
        this.extractRecipients();
    
        console.log('Total properties extracted:', Object.keys(this.properties).length);
    };

    MsgReader.prototype.convertPropertyValue = function(data, type, propId) {
        if (!data || data.length === 0) {
            return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        // FIX #2: Handle OFT body (binary type but text content)
        if (type === PROP_TYPE_BINARY && (propId === PROP_ID_BODY || propId === PROP_ID_HTML_BODY)) {
            console.log('Binary body property detected, forcing text conversion...');
            // Try UTF-8 first, as it's common in modern files
            var text = dataViewToString(view, 'utf-8');
            // Basic heuristic: if it contains HTML tags, it's probably right.
            if (text.indexOf('<') > -1 && text.indexOf('>') > -1) {
                console.log('  Detected UTF-8 body');
                return text;
            }
            // Fallback to UTF-16LE
            text = dataViewToString(view, 'utf16le');
            if (text.length > 0) {
                console.log('  Detected UTF-16LE body');
                return text;
            }
            // If both fail, return the binary data
            return data;
        }

        switch (type) {
            case PROP_TYPE_STRING8: // 0x001F (PT_UNICODE / UTF-16LE string)
                return dataViewToString(view, 'utf16le');

            //
            // START FIX 1: Restore UTF-8 decoding for 0x001E
            //
            case PROP_TYPE_STRING: // 0x001E (PT_STRING8 / ASCII/UTF-8 string)
                return dataViewToString(view, 'utf-8');
            //
            // END FIX 1
            //

            case PROP_TYPE_INTEGER32: // 0x0003 (PT_LONG)
                return view.byteLength >= 4 ? view.getUint32(0, true) : 0;

            case PROP_TYPE_BOOLEAN: // 0x000B (PT_BOOLEAN)
                return view.byteLength > 0 ? view.getUint8(0) !== 0 : false;

            case PROP_TYPE_TIME: // 0x0040 (PT_SYSTIME / FILETIME)
                if (view.byteLength >= 8) {
                    var low = view.getUint32(0, true);
                    var high = view.getUint32(4, true);
                    return filetimeToDate(low, high);
                }
                return null;

            case PROP_TYPE_BINARY: // 0x0102 (PT_BINARY)
                // Check if this looks like text data
                if (this.looksLikeText(data)) {
                    console.log('Binary data for prop ' + (propId ? propId.toString(16) : 'N/A') + ' looks like text, converting...');
                    // Try UTF-8 first
                    var text = dataViewToString(view, 'utf-8');
                    if (text && text.length > 0 && text.replace(/[^\x20-\x7E\n\r\t]/g, '').length > text.length * 0.5) {
                        console.log('  Detected UTF-8');
                        return text;
                    }
                    // Try UTF-16LE
                    text = dataViewToString(view, 'utf16le');
                    if (text && text.length > 0 && text.replace(/[^\x20-\x7E\n\r\t]/g, '').length > text.length * 0.5) {
                        console.log('  Detected UTF-16LE');
                        return text;
                    }
                }
                return data;

            default:
                // Unknown type - try to detect if it's text
                if (this.looksLikeText(data)) {
                    var text = dataViewToString(view, 'utf-16le');
                    if (text && text.length > 0) {
                        return text;
                    }
                }
                return data;
        }
    };
    
    MsgReader.prototype.looksLikeText = function(data) {
        if (!data || data.length < 4) {
            return false;
        }

        // Check if data starts with common text patterns
        var printableCount = 0;
        var totalChecked = Math.min(100, data.length);
        
        if (totalChecked === 0) return false;

        for (var i = 0; i < totalChecked; i++) {
            var byte = data[i];
            // Printable ASCII, newline, carriage return, tab, or null (for UTF-16)
            if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x0A || byte === 0x0D || byte === 0x09 || byte === 0x00) {
                printableCount++;
            }
        }

        // If more than 70% looks like text, treat it as text
        return (printableCount / totalChecked) > 0.7;
    };

    /**
     * Helper for FIX 2
     * Safely parses an email address string, which might be "Name <email@domain.com>"
     * or just "email@domain.com".
     * @param {string} addr - The address string to parse.
     * @returns {{name: string, email: string}}
     */
    function parseAddress(addr) {
        addr = addr.trim();
        var email = addr;
        var name = addr;
        
        var match = addr.match(/^(.*)<([^>]+)>$/);
        if (match) {
            name = match[1].trim().replace(/^"|"$/g, ''); // Clean quotes from name
            email = match[2].trim();
        }

        // If no angle brackets, check if it's a valid email.
        // If not, it's just a name with no email.
        if (email.indexOf('@') === -1) {
            email = null; // It's just a display name
        } else {
             // If we have an email but the name is still the email, strip it
             if (name === email) {
                name = '';
             }
        }

        return { name: name, email: email };
    }

    MsgReader.prototype.extractRecipients = function() {
        var self = this;
        var recipients = [];
        var recipientMap = {}; // Use a map to de-duplicate based on email
    
        console.log('Extracting recipients...');
    
        // Method 1: Look for recipient properties in directory structure
        var recipientStorages = this.directoryEntries.filter(function(entry) {
            return entry.type === 1 && entry.name.indexOf('__recip_version1.0_') === 0;
        });
    
        console.log('Found recipient storages:', recipientStorages.length);
    
        recipientStorages.forEach(function(recipStorage) {
            var recipient = {
                recipientType: RECIPIENT_TYPE_TO, // Default to TO
                name: '',
                email: ''
            };
    
            var recipStorageName = recipStorage.name;
            //
            // START FINAL FIX: Correct Tree Traversal (from v1.4.2)
            //
            console.log('  Looking for properties for storage:', recipStorageName, 'starting at childId:', recipStorage.childId);
            
            var stack = [recipStorage.childId];
            var visited = new Set();
            var maxProps = 100; // Safety break
            var propsFound = 0;

            while (stack.length > 0 && propsFound < maxProps) {
                var entryId = stack.pop();

                // Check for invalid/visited entry ID
                if (entryId === -1 || entryId === 0xFFFFFFFF || !entryId || visited.has(entryId)) {
                    continue;
                }
                visited.add(entryId);

                var entry = self.directoryEntries[entryId];
                if (!entry) {
                    console.warn('  Invalid entry ID in tree walk:', entryId);
                    continue;
                }

                // Process this entry
                if (entry.type === 2 && entry.name.indexOf('__substg1.0_') > -1) {
                    propsFound++;
                    var propTag = "00000000";
                    if (entry.name.length >= 20) { // Basic check for __substg1.0_XXXXYYYY
                        propTag = entry.name.substring(entry.name.length - 8);
                    } else {
                        // Fallback for shorter names
                        var parts = entry.name.split('_');
                        if (parts.length >= 3) {
                            propTag = parts[2];
                        }
                    }

                    var propId = parseInt(propTag.substring(0, 4), 16);
                    var propType = parseInt(propTag.substring(4, 8), 16);
    
                    var streamData = self.readStream(entry);
                    var value = self.convertPropertyValue(streamData, propType, propId);
    
                    console.log('    Found prop:', { name: entry.name, propId: propId.toString(16), value: (typeof value === 'string' ? value.substring(0, 50) : value) });
    
                    // Assign properties based on official IDs
                    switch(propId) {
                        case PROP_ID_RECIPIENT_DISPLAY_NAME: // 0x3001
                            recipient.name = value || recipient.name;
                            break;
                        case PROP_ID_RECIPIENT_EMAIL_ADDRESS: // 0x3003
                        case PROP_ID_RECIPIENT_SMTP_ADDRESS: // 0x39FE
                            recipient.email = value || recipient.email;
                            break;
                        case PROP_ID_RECIPIENT_TYPE: // 0x0C15
                            if (typeof value === 'number') {
                                recipient.recipientType = value;
                            }
                            break;
                    }
                }

                // Add children/siblings to stack for traversal
                if (entry.leftSiblingId !== -1 && entry.leftSiblingId < self.directoryEntries.length && !visited.has(entry.leftSiblingId)) {
                    stack.push(entry.leftSiblingId);
                }
                if (entry.rightSiblingId !== -1 && entry.rightSiblingId < self.directoryEntries.length && !visited.has(entry.rightSiblingId)) {
                    stack.push(entry.rightSiblingId);
                }
                if (entry.childId !== -1 && entry.childId < self.directoryEntries.length && !visited.has(entry.childId)) {
                    // This will traverse into sub-storages, which is also correct
                    stack.push(entry.childId);
                }
            }
            //
            // END FINAL FIX
            //
    
            if (recipient.name || recipient.email) {
                // Fallback: If email is missing but name is, check if name is email
                if (!recipient.email && recipient.name && recipient.name.indexOf('@') > -1) {
                    recipient.email = recipient.name;
                }
                // Fallback: If name is missing but email is present, use email as name.
                if (!recipient.name && recipient.email) {
                    recipient.name = recipient.email;
                }
                
                // Use email as the key to prevent duplicates
                if (recipient.email) {
                    var key = recipient.email.toLowerCase();
                    if (!recipientMap[key]) {
                         console.log('  Adding recipient from OLE tree:', recipient);
                        recipientMap[key] = recipient;
                    }
                }
            }
        });
    
        //
        // START FIX: Re-ordered fallbacks. Method 3 (MIME) now runs BEFORE Method 2 (Display Fields).
        //
        
        //
        // Fallback Method 2: (Formerly Method 3) "Smart" MIME-header scan
        // This is the most reliable fallback for hybrid O365 files.
        //
        console.log('Running fallback recipient extraction (Method 2 - MIME Scan)...');
        var mimeData = this._scanBufferForMimeText();
        
        if (mimeData.to) {
            // Split by comma or semicolon
            mimeData.to.split(/[;,]/).forEach(function(addrStr) {
                var parsed = parseAddress(addrStr);
                if (parsed.email) {
                    var key = parsed.email.toLowerCase();
                    if (!recipientMap[key]) { // Only add if not already present
                        console.log('Adding recipient from MIME (To):', parsed);
                        recipientMap[key] = {
                            recipientType: RECIPIENT_TYPE_TO,
                            name: parsed.name || parsed.email,
                            email: parsed.email
                        };
                    }
                }
            });
        }
        
        if (mimeData.cc) {
            // Split by comma or semicolon
            mimeData.cc.split(/[;,]/).forEach(function(addrStr) {
                var parsed = parseAddress(addrStr);
                if (parsed.email) {
                    var key = parsed.email.toLowerCase();
                    if (!recipientMap[key]) { // Only add if not already present
                         console.log('Adding recipient from MIME (Cc):', parsed);
                        recipientMap[key] = {
                            recipientType: RECIPIENT_TYPE_CC,
                            name: parsed.name || parsed.email,
                            email: parsed.email
                        };
                    }
                }
            });
        }

        //
        // Fallback Method 3: (Formerly Method 2) Extract from OLE display fields
        // This runs last as it can be unreliable in hybrid files.
        //
        console.log('Running fallback recipient extraction (Method 3 - Display Fields)...');
        var displayTo = self.properties[PROP_ID_DISPLAY_TO] ? self.properties[PROP_ID_DISPLAY_TO].value : null;
        var displayCc = self.properties[PROP_ID_DISPLAY_CC] ? self.properties[PROP_ID_DISPLAY_CC].value : null;
        var displayBcc = self.properties[PROP_ID_DISPLAY_BCC] ? self.properties[PROP_ID_DISPLAY_BCC].value : null;

        if (displayTo) {
            displayTo.split(';').forEach(function(addrStr) {
                var parsed = parseAddress(addrStr);
                if (parsed.email) {
                    var key = parsed.email.toLowerCase();
                    if (!recipientMap[key]) { // Only add if key NOT added by OLE or MIME
                        console.log('Adding recipient from Display Field (To):', parsed);
                        recipientMap[key] = {
                            recipientType: RECIPIENT_TYPE_TO,
                            name: parsed.name || parsed.email,
                            email: parsed.email
                        };
                    }
                }
            });
        }

        if (displayCc) {
            displayCc.split(';').forEach(function(addrStr) {
                var parsed = parseAddress(addrStr);
                if (parsed.email) {
                    var key = parsed.email.toLowerCase();
                    if (!recipientMap[key]) { // Only add if key NOT added by OLE or MIME
                        console.log('Adding recipient from Display Field (Cc):', parsed);
                        recipientMap[key] = {
                            recipientType: RECIPIENT_TYPE_CC,
                            name: parsed.name || parsed.email,
                            email: parsed.email
                        };
                    }
                }
            });
        }

        if (displayBcc) {
            displayBcc.split(';').forEach(function(addrStr) {
                 var parsed = parseAddress(addrStr);
                 if (parsed.email) {
                    var key = parsed.email.toLowerCase();
                    if (!recipientMap[key]) { // Only add if key NOT added by OLE or MIME
                        console.log('Adding recipient from Display Field (Bcc):', parsed);
                        recipientMap[key] = {
                            recipientType: RECIPIENT_TYPE_BCC,
                            name: parsed.name || parsed.email,
                            email: parsed.email
                        };
                    }
                }
            });
        }
        
        //
        // END FIX
        //

        // Convert map back to array
        for (var key in recipientMap) {
            recipients.push(recipientMap[key]);
        }
    
        console.log('Total recipients extracted:', recipients.length);
        
        this.properties['recipients'] = {
            id: 0,
            type: 0,
            value: recipients
        };
    };

    MsgReader.prototype.getFieldValue = function(fieldName) {
        var propId;

        switch (fieldName) {
            case 'subject':
                propId = PROP_ID_SUBJECT;
                break;
            case 'body':
                propId = PROP_ID_BODY;
                break;
            case 'bodyHTML':
                propId = PROP_ID_HTML_BODY;
                break;
            case 'senderName':
                propId = PROP_ID_SENDER_NAME;
                break;
            case 'senderEmail':
                propId = PROP_ID_SENDER_EMAIL;
                break;
            case 'recipients':
                return this.properties['recipients'] ? this.properties['recipients'].value : [];
            default:
                return null;
        }

        var prop = this.properties[propId];
        return prop ? prop.value : null;
    };

    // Public API
    return {
        read: function(arrayBuffer) {
            var reader = new MsgReader(arrayBuffer);
            return reader.parse();
        }
    };
}));

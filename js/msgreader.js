/**
 * msg-reader.js v1.4.16 (Refactored)
 * Production-grade Microsoft Outlook MSG/OFT/EML file parser
 *
 * This script provides a pure JavaScript parser for Microsoft Outlook .msg and .oft
 * files (OLE Compound File Binary Format) AND plain-text .eml/.email files (MIME).
 *
 * It automatically detects the file type based on its signature and uses the
 * appropriate parsing logic.
 *
 * Based on the original msg.reader by Peter Theill.
 * Licensed under MIT.
 *
 * CHANGELOG:
 * v1.4.16 (Gemini Feature):
 * 1. [FEATURE] Added file-type sniffing. The static `read()` function now
 * checks the file's 8-byte signature.
 * 2. [FEATURE] If OLE signature is found, it calls `reader.parse()` (original OLE parser).
 * 3. [FEATURE] If OLE signature is NOT found, it calls `reader.parseMime()` (new MIME parser).
 * 4. [FEATURE] Added `parseMime()` to parse plain-text .eml/.email files using
 * regex-based header and body extraction.
 * 5. [DEBUG] Re-enabled all console.log statements for testing new file types.
 *
 * v1.4.15 (Gemini Patch):
 * 1. [FIX] Prevents property overwrite in `extractProperties` for .oft files.
 *
 * v1.4.10 (Gemini Patch):
 * 1. [FIX] Implemented counting for Method 3 (Display Fields) recipient logic.
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // CommonJS
        module.exports = factory();
    } else {
        // Browser globals
        root.MsgReader = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // --- MAPI Property Types ---
    var PROP_TYPE_INTEGER32 = 0x0003; // 32-bit integer
    var PROP_TYPE_BOOLEAN = 0x000B; // Boolean
    var PROP_TYPE_STRING = 0x001E; // String8 (ASCII/UTF-8)
    var PROP_TYPE_STRING8 = 0x001F; // Unicode (UTF-16LE)
    var PROP_TYPE_TIME = 0x0040; // 64-bit FILETIME
    var PROP_TYPE_BINARY = 0x0102; // Binary data

    // --- MAPI Property IDs ---
    var PROP_ID_SUBJECT = 0x0037; // PidTagSubject
    var PROP_ID_BODY = 0x1000; // PidTagBody
    var PROP_ID_HTML_BODY = 0x1013; // PidTagBodyHtml
    var PROP_ID_DISPLAY_TO = 0x0E04; // PidTagDisplayTo
    var PROP_ID_DISPLAY_CC = 0x0E03; // PidTagDisplayCc
    var PROP_ID_DISPLAY_BCC = 0x0E02; // PidTagDisplayBcc

    // Recipient-specific Property IDs
    var PROP_ID_RECIPIENT_TYPE = 0x0C15; // PidTagRecipientType
    var PROP_ID_RECIPIENT_DISPLAY_NAME = 0x3001; // PidTagDisplayName
    var PROP_ID_RECIPIENT_EMAIL_ADDRESS = 0x3003; // PidTagEmailAddress (Legacy)
    var PROP_ID_RECIPIENT_SMTP_ADDRESS = 0x39FE; // PidTagSmtpAddress

    // --- MAPI Recipient Types ---
    var RECIPIENT_TYPE_TO = 1;
    var RECIPIENT_TYPE_CC = 2;
    var RECIPIENT_TYPE_BCC = 3;
    
    // --- (Mode C/D) Helper function for text processing ---
    /**
     * Strips HTML tags and decodes HTML entities.
     * @param {string} html - The HTML string.
     * @returns {string} The plain text.
     */
    function _stripHtml(html) {
        if (!html) return '';
        return html
            .replace(/<style[^>]*>.*?<\/style>/gi, '')  // Remove style blocks
            .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script blocks
            .replace(/<[^>]+>/g, '')                     // Remove all other tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }
    
    /**
     * Normalizes line breaks and cleans up text.
     * @param {string} text - The text to clean.
     * @returns {string} The cleaned text.
     */
    function _normalizeText(text) {
        if (!text) return '';
        return text.replace(/(\r\n|\r|\n){3,}/g, '\n\n').trim(); // Collapse 3+ newlines to 2
    }
    // --- END HELPER ---

    /**
     * Converts a DataView object to a string based on the specified encoding.
     * @param {DataView} view - The DataView to read from.
     * @param {string} encoding - The encoding ('utf16le', 'utf-8', or 'ascii').
     * @returns {string} The decoded string.
     */
    function dataViewToString(view, encoding) {
        var result = '';
        var length = view.byteLength;
        
        if (encoding === 'utf16le') {
            // Read UTF-16LE (2 bytes per character)
            for (var i = 0; i < length; i += 2) {
                if (i + 1 < length) {
                    var charCode = view.getUint16(i, true); // true for little-endian
                    if (charCode === 0) break; // Null terminator
                    result += String.fromCharCode(charCode);
                }
            }
        } else if (encoding === 'utf-8') {
            // Read UTF-8
            try {
                // Use TextDecoder for efficient and correct UTF-8 parsing
                if (typeof TextDecoder !== 'undefined') {
                    var decoded = new TextDecoder('utf-8', { fatal: false }).decode(view);
                    // Remove null terminators
                    const nullIdx = decoded.indexOf('\0');
                    if (nullIdx !== -1) {
                        return decoded.substring(0, nullIdx);
                    }
                    return decoded;
                }
                
                // Fallback manual UTF-8 decoder for older environments
                var bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
                var str = '';
                for (var i = 0; i < bytes.length; i++) {
                    var charCode = bytes[i];
                    if (charCode === 0) break; // Null terminator
                    
                    if (charCode < 0x80) {
                        str += String.fromCharCode(charCode);
                    } else if (charCode < 0xE0) {
                        // 2-byte sequence
                        str += String.fromCharCode(((charCode & 0x1F) << 6) | (bytes[++i] & 0x3F));
                    } else if (charCode < 0xF0) {
                        // 3-byte sequence
                        str += String.fromCharCode(((charCode & 0x0F) << 12) | ((bytes[++i] & 0x3F) << 6) | (bytes[++i] & 0x3F));
                    } else {
                        // 4-byte sequence (for supplementary planes)
                        var codePoint = ((charCode & 0x07) << 18) | ((bytes[++i] & 0x3F) << 12) | ((bytes[++i] & 0x3F) << 6) | (bytes[++i] & 0x3F);
                        codePoint -= 0x10000;
                        str += String.fromCharCode(0xD800 + (codePoint >> 10), 0xDC00 + (codePoint & 0x3FF));
                    }
                }
                return str;
            } catch (e) {
                // Fallback to ASCII if UTF-8 decoding fails
                return dataViewToString(view, 'ascii');
            }
        } else {
            // Read ASCII (or treat as 1-byte per char)
            for (var i = 0; i < length; i++) {
                var charCode = view.getUint8(i);
                if (charCode === 0) break; // Null terminator
                // Only allow printable ASCII + common whitespace
                if (charCode === 9 || charCode === 10 || charCode === 13 || (charCode >= 32 && charCode <= 126)) {
                    result += String.fromCharCode(charCode);
                }
            }
        }
        
        return result;
    }

    /**
     * Converts a 64-bit Windows FILETIME (as two 32-bit values) to a JavaScript Date.
     * @param {number} low - The low 32 bits of the FILETIME.
     * @param {number} high - The high 32 bits of the FILETIME.
     * @returns {Date|null} The corresponding Date object, or null if parsing fails.
     */
    function filetimeToDate(low, high) {
        // FILETIME is a 64-bit value representing 100-nanosecond intervals
        // since January 1, 1601 (UTC).
        
        // Difference between Windows epoch (1601-01-01) and Unix epoch (1970-01-01)
        // in 100-nanosecond intervals.
        var FILETIME_EPOCH_DIFF = 116444736000000000n;
        // Number of 100-nanosecond intervals per millisecond.
        var TICKS_PER_MILLISECOND = 10000n;
        
        try {
            // Combine high and low bits into a 64-bit BigInt
            var filetime = (BigInt(high) << 32n) | BigInt(low);
            // Convert to milliseconds since Unix epoch
            var milliseconds = (filetime - FILETIME_EPOCH_DIFF) / TICKS_PER_MILLISECOND;
            return new Date(Number(milliseconds));
        } catch (e) {
            console.warn('Failed to parse date:', e);
            return null;
        }
    }

    /**
     * Main MsgReader class.
     * @param {ArrayBuffer|Uint8Array|Array} arrayBuffer - The input MSG file data.
     * @constructor
     */
    function MsgReader(arrayBuffer) {
        this.buffer = null;
        this.dataView = null;
        
        // --- Input Handling ---
        if (arrayBuffer instanceof ArrayBuffer) {
            this.buffer = arrayBuffer;
        } else if (arrayBuffer instanceof Uint8Array) {
            // Create a new ArrayBuffer from the Uint8Array's view
            this.buffer = arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
        } else if (Array.isArray(arrayBuffer)) {
            // Convert array of bytes to Uint8Array, then to ArrayBuffer
            this.buffer = new Uint8Array(arrayBuffer).buffer;
        } else {
            throw new Error('Invalid input: expected ArrayBuffer, Uint8Array, or Array');
        }
        
        this.dataView = new DataView(this.buffer);

        // --- OLE Compound File Structures ---
        this.header = null; // OLE file header
        this.fat = null; // File Allocation Table
        this.miniFat = null; // Mini File Allocation Table
        this.directoryEntries = []; // List of all directory entries
        
        // --- Parsed Data ---
        this.properties = {}; // Extracted MAPI properties
        
        // --- Caches ---
        this._mimeScanCache = null; // Cache for the raw MIME text scan
    }

    /**
     * Initiates the OLE parsing of the MSG file.
     * @returns {object} An object containing the parsed fields.
     */
    MsgReader.prototype.parse = function() {
        try {
            // This is the main orchestration sequence for parsing the OLE file
            // and then extracting the MAPI properties.
            this.readHeader();
            this.readFAT();
            this.readMiniFAT();
            this.readDirectory();
            this.extractProperties();
            
            // Return a public-facing object with common fields
            return {
                getFieldValue: this.getFieldValue.bind(this),
                subject: this.getFieldValue('subject'),
                body: this.getFieldValue('body'),
                bodyHTML: this.getFieldValue('bodyHTML'),
                recipients: this.getFieldValue('recipients')
            };
        } catch (e) {
            console.error('MSG parsing error:', e);
            throw new Error('Failed to parse MSG file: ' + e.message);
        }
    };
    
    /**
     * Initiates the MIME (.eml) parsing of the file.
     * @returns {object} An object containing the parsed fields.
     */
    MsgReader.prototype.parseMime = function() {
        console.log('File is not OLE. Parsing as plain text (MIME/EML)...');
        
        try {
            // We can't use the cache, as it might be from a different file
            this._mimeScanCache = null; 
            var mimeData = this._scanBufferForMimeText();
            
            var recipients = [];
            
            // Helper to parse address lists (re-defined here for scope)
            var parseMimeAddresses = function(addrString, type) {
                if (!addrString) return;
                // Split by comma, but not commas inside quotes
                addrString.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).forEach(function(addr) {
                    var parsed = parseAddress(addr); // Use our existing helper
                    if (parsed.email) {
                        recipients.push({
                            name: parsed.name,
                            email: parsed.email,
                            recipientType: type
                        });
                    }
                });
            };

            parseMimeAddresses(mimeData.to, RECIPIENT_TYPE_TO);
            parseMimeAddresses(mimeData.cc, RECIPIENT_TYPE_CC);
            
            // Now, manually scan for Bcc (since _scanBuffer doesn't get it)
            // We have to decode again, or cache the raw text
            var rawText = '';
             try {
                rawText = new TextDecoder('utf-8', { fatal: false }).decode(this.dataView);
            } catch (e) {
                rawText = new TextDecoder('latin1').decode(this.dataView);
            }
            
            var bccMatch = rawText.match(/\bBcc:\s*([^\r\n]+)/i);
            if (bccMatch) {
                parseMimeAddresses(bccMatch[1].trim(), RECIPIENT_TYPE_BCC);
            }

            // Populate properties map so getFieldValue works
            this.properties[PROP_ID_SUBJECT] = { id: PROP_ID_SUBJECT, value: mimeData.subject };
            this.properties[PROP_ID_BODY] = { id: PROP_ID_BODY, value: mimeData.body };
            this.properties[PROP_ID_HTML_BODY] = { id: PROP_ID_HTML_BODY, value: null }; // Simple parser doesn't support HTML body parts yet
            this.properties['recipients'] = { id: 0, value: recipients };

            // Return the same standard object
            return {
                getFieldValue: this.getFieldValue.bind(this),
                subject: mimeData.subject,
                body: mimeData.body,
                bodyHTML: null, 
                recipients: recipients
            };
        } catch (e) {
             console.error('MIME parsing error:', e);
            throw new Error('Failed to parse MIME/EML file: ' + e.message);
        }
    };

    /**
     * Reads the OLE (Compound File Binary Format) header.
     */
    MsgReader.prototype.readHeader = function() {
        // The OLE header is 512 bytes
        if (this.buffer.byteLength < 512) {
            throw new Error('File too small to be valid MSG/OFT file');
        }

        // Check OLE signature: 0xD0CF11E0A1B11AE1
        var sig1 = this.dataView.getUint32(0, true);
        var sig2 = this.dataView.getUint32(4, true);
        
        // This check is technically redundant now, as read() does it first
        if (sig1 !== 0xE011CFD0 || sig2 !== 0xE11AB1A1) {
            // --- (Mode C) User-friendly error ---
            throw new Error('Invalid file signature. Not a valid OLE file (MSG/OFT).');
        }

        // Read key header fields
        this.header = {
            sectorShift: this.dataView.getUint16(30, true), // Sector size (2^sectorShift)
            miniSectorShift: this.dataView.getUint16(32, true), // Mini sector size (2^miniSectorShift)
            totalSectors: this.dataView.getUint32(40, true), // Not used
            fatSectors: this.dataView.getUint32(44, true), // Number of FAT sectors
            directoryFirstSector: this.dataView.getUint32(48, true), // Start sector for directory
            miniFatFirstSector: this.dataView.getUint32(60, true), // Start sector for MiniFAT
            miniFatTotalSectors: this.dataView.getUint32(64, true), // Number of MiniFAT sectors
            difFirstSector: this.dataView.getUint32(68, true), // Start sector for DIFAT
            difTotalSectors: this.dataView.getUint32(72, true) // Number of DIFAT sectors
        };

        // Calculate actual sizes from shifts
        this.header.sectorSize = Math.pow(2, this.header.sectorShift);
        this.header.miniSectorSize = Math.pow(2, this.header.miniSectorShift);

        console.log('MSG Header:', this.header);
    };

    /**
     * Reads the File Allocation Table (FAT) and DIFAT (Double-Indirect FAT).
     * The FAT describes the sector chains for regular streams.
     */
    MsgReader.prototype.readFAT = function() {
        var sectorSize = this.header.sectorSize;
        var entriesPerSector = sectorSize / 4; // 4 bytes per entry
        this.fat = [];

        // 1. Read FAT sectors listed directly in the header (first 109)
        var fatSectorPositions = [];
        for (var i = 0; i < 109 && i < this.header.fatSectors; i++) {
            var sectorNum = this.dataView.getUint32(76 + i * 4, true);
            if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF) {
                fatSectorPositions.push(sectorNum);
            }
        }
        
        // 2. Read DIFAT sectors if they exist (for files with > 109 FAT sectors)
        if (this.header.difTotalSectors > 0) {
            var difSector = this.header.difFirstSector;
            var difSectorsRead = 0;
            
            while(difSector !== 0xFFFFFFFE && difSector !== 0xFFFFFFFF && difSectorsRead < this.header.difTotalSectors) {
                var difOffset = 512 + difSector * sectorSize;
                
                // Read up to (entriesPerSector - 1) sector positions from this DIFAT sector
                for (var j = 0; j < entriesPerSector - 1; j++) {
                    var sectorNum = this.dataView.getUint32(difOffset + j * 4, true);
                    if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF) {
                        fatSectorPositions.push(sectorNum);
                    }
                }
                
                // The last 4 bytes point to the next DIFAT sector
                difSector = this.dataView.getUint32(difOffset + (entriesPerSector - 1) * 4, true);
                difSectorsRead++;
            }
        }

        // 3. Read all FAT entries from the collected sector positions
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

    /**
     * Reads the Mini File Allocation Table (MiniFAT).
     * The MiniFAT describes sector chains for streams < 4096 bytes,
     * which are stored in the Mini Stream.
     */
    MsgReader.prototype.readMiniFAT = function() {
        if (this.header.miniFatFirstSector === 0xFFFFFFFE || 
            this.header.miniFatFirstSector === 0xFFFFFFFF) {
            this.miniFat = [];
            return; // No MiniFAT
        }

        this.miniFat = [];
        var sector = this.header.miniFatFirstSector;
        var sectorSize = this.header.sectorSize;
        var entriesPerSector = sectorSize / 4;
        var sectorsRead = 0;

        // Read the chain of MiniFAT sectors
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
                 break; // Sector index out of bounds, chain is broken
            }
            sector = this.fat[sector]; // Find next MiniFAT sector in the main FAT
            sectorsRead++;
        }

        console.log('MiniFAT entries:', this.miniFat.length);
    };

    /**
     * Reads the directory structure, which contains entries for all
     * storages (folders) and streams (files) in the OLE file.
     */
    MsgReader.prototype.readDirectory = function() {
        var sector = this.header.directoryFirstSector;
        var sectorSize = this.header.sectorSize;
        var entrySize = 128; // Each directory entry is 128 bytes
        var entriesPerSector = sectorSize / entrySize;
        var sectorsRead = 0;

        // Follow the chain of directory sectors
        while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sectorsRead < 1000) { // Safety break
            var sectorOffset = 512 + sector * sectorSize;

            for (var i = 0; i < entriesPerSector; i++) {
                var entryOffset = sectorOffset + i * entrySize;
                
                if (entryOffset + entrySize > this.buffer.byteLength) {
                    break; // EOF
                }

                var entry = this.readDirectoryEntry(entryOffset);
                if (entry && entry.name) {
                    this.directoryEntries.push(entry);
                }
            }
            
            if (sector >= this.fat.length) {
                 console.warn('Directory sector chain error: sector index out of bounds.');
                 break; // Sector index out of bounds, chain is broken
            }
            sector = this.fat[sector]; // Find next directory sector in the main FAT
            sectorsRead++;
        }

        console.log('Directory entries:', this.directoryEntries.length);
        
        // Assign a simple ID to each entry for tree traversal
        this.directoryEntries.forEach((de, idx) => de.id = idx);
    };

    /**
     * Reads a single 128-byte directory entry.
     * @param {number} offset - The offset of the directory entry in the buffer.
     * @returns {object|null} The parsed directory entry, or null if invalid.
     */
    MsgReader.prototype.readDirectoryEntry = function(offset) {
        // Read name (64 bytes, UTF-16LE)
        var nameLength = this.dataView.getUint16(offset + 64, true);
        if (nameLength === 0 || nameLength > 64) {
            return null; // Invalid or empty entry
        }

        var nameView = new DataView(this.buffer, offset, Math.min(nameLength, 64));
        var name = dataViewToString(nameView, 'utf16le');

        var type = this.dataView.getUint8(offset + 66);
        
        // 1=Storage, 2=Stream, 5=Root
        if (type !== 1 && type !== 2 && type !== 5) {
            return null; // Skip unknown/invalid types
        }

        var startSector = this.dataView.getUint32(offset + 116, true);
        var size = this.dataView.getUint32(offset + 120, true);
        
        // Read tree node IDs
        var leftSiblingId = this.dataView.getInt32(offset + 68, true);
        var rightSiblingId = this.dataView.getInt32(offset + 72, true);
        var childId = this.dataView.getInt32(offset + 76, true);

        return {
            name: name,
            type: type, 
            startSector: startSector,
            size: size,
            leftSiblingId: leftSiblingId,
            rightSiblingId: rightSiblingId,
            childId: childId,
            id: -1 // Will be assigned later by readDirectory
        };
    };

    /**
     * Reads a data stream from the file.
     * @param {object} entry - The directory entry for the stream.
     * @returns {Uint8Array} The stream's data.
     */
    MsgReader.prototype.readStream = function(entry) {
        if (!entry || entry.size === 0) {
            return new Uint8Array(0);
        }

        var data = new Uint8Array(entry.size);
        var dataOffset = 0;
        var sectorSize = this.header.sectorSize;
        var miniSectorSize = this.header.miniSectorSize;

        // Determine if we use FAT or MiniFAT
        // Streams < 4096 bytes are typically in the Mini Stream
        var useMini = entry.size < 4096;

        if (useMini) {
            // Read from MiniFAT
            var rootEntry = this.directoryEntries.find(function(e) { return e.type === 5; });
            if (!rootEntry) {
                console.warn('Root entry not found for MiniFAT stream');
                return new Uint8Array(0); // Should not happen
            }

            // The Mini Stream is stored as a regular stream in the root entry
            var miniStreamData = this.readStream(rootEntry);
            var sector = entry.startSector;
            var sectorsRead = 0;

            while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && 
                   dataOffset < entry.size && sectorsRead < 10000) { // Safety break
                
                var miniOffset = sector * miniSectorSize;
                var bytesToCopy = Math.min(miniSectorSize, entry.size - dataOffset);

                for (var i = 0; i < bytesToCopy && miniOffset + i < miniStreamData.length; i++) {
                    data[dataOffset++] = miniStreamData[miniOffset + i];
                }

                if (sector >= this.miniFat.length) {
                    console.warn('MiniFAT sector chain error: sector index out of bounds.');
                    break; // Sector index out of bounds
                }
                sector = this.miniFat[sector]; // Find next sector in MiniFAT
                sectorsRead++;
            }
        } else {
            // Read from main FAT
            var sector = entry.startSector;
            var sectorsRead = 0;

            while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && 
                   dataOffset < entry.size && sectorsRead < 10000) { // Safety break
                
                var sectorOffset = 512 + sector * sectorSize;
                var bytesToCopy = Math.min(sectorSize, entry.size - dataOffset);

                for (var i = 0; i < bytesToCopy && sectorOffset + i < this.buffer.byteLength; i++) {
                    data[dataOffset++] = this.dataView.getUint8(sectorOffset + i);
                }

                if (sector >= this.fat.length) {
                    console.warn('FAT sector chain error: sector index out of bounds.');
                    break; // Sector index out of bounds
                }
                sector = this.fat[sector]; // Find next sector in main FAT
                sectorsRead++;
            }
        }

        return data.slice(0, dataOffset);
    };

    /**
     * Scans the raw file buffer for plain-text MIME headers.
     * This is a fallback for modern Outlook 365 files that store key
     * data as plain text instead of in OLE streams.
     * @returns {object} An object with found headers {subject, to, cc, body}.
     */
    MsgReader.prototype._scanBufferForMimeText = function() {
        if (this._mimeScanCache) {
            return this._mimeScanCache; // Return from cache if already scanned
        }

        console.log('Scanning raw buffer for MIME text...');
        var rawText = '';
        try {
            // Try UTF-8 first, as it's common
            rawText = new TextDecoder('utf-8', { fatal: false }).decode(this.dataView);
        } catch (e) {
            // Fallback to latin1 (which handles arbitrary bytes)
            try {
                rawText = new TextDecoder('latin1').decode(this.dataView);
            } catch (e2) {
                console.warn('Could not decode raw buffer for MIME scan.');
                // If decoding fails, we can't scan
                return { subject: null, to: null, cc: null, body: null };
            }
        }

        var result = {
            subject: null,
            to: null,
            cc: null,
            body: null
        };

        // Use flexible regex to find headers.
        // \b - word boundary, \s* - zero or more whitespace, ([^\r\n]+) - capture value
        var subjectMatch = rawText.match(/\bSubject:\s*([^\r\n]+)/i);
        if (subjectMatch) {
            result.subject = subjectMatch[1].trim();
            console.log('MIME Scan found Subject:', result.subject);
        }

        var toMatch = rawText.match(/\bTo:\s*([^\r\n]+)/i);
        if (toMatch) {
            result.to = toMatch[1].trim();
            console.log('MIME Scan found To:', result.to);
        }

        var ccMatch = rawText.match(/\bCc:\s*([^\r\n]+)/i);
        if (ccMatch) {
            result.cc = ccMatch[1].trim();
            console.log('MIME Scan found Cc:', result.cc);
        }
        
        // Find body: Look for the first double-linebreak (header/body separator)
        var headerEndMatch = rawText.match(/(\r\n\r\n|\n\n)/);
        if (headerEndMatch) {
            var bodyText = rawText.substring(headerEndMatch.index + headerEndMatch[0].length);
            
            // Try to find the *plain text* body part in a multipart message
            var plainBodyMatch = bodyText.match(/Content-Type:\s*text\/plain;[\s\S]*?(\r\n\r\n|\n\n)([\s\S]*?)(--_?|\r\n\r\nContent-Type:)/im);
            
            if (plainBodyMatch && plainBodyMatch[2]) {
                result.body = plainBodyMatch[2].trim();
            } else {
                // If not multipart or no plain text part found,
                // just take the first chunk of text as the body.
                result.body = bodyText.split(/--_?|\r\n\r\nContent-Type:/)[0].trim();
            }
            console.log('MIME Scan found Body (first 50 chars):', result.body ? result.body.substring(0, 50) : 'null');
        }

        this._mimeScanCache = result; // Cache the result
        return result;
    };

    /**
     * Iterates through directory entries, finds MAPI property streams,
     * reads them, and stores them in `this.properties`.
     */
    MsgReader.prototype.extractProperties = function() {
        var self = this;
        var rawProperties = {}; // Temp store for raw stream data
    
        console.log('Extracting properties from', this.directoryEntries.length, 'entries...');
    
        // Find all property streams
        this.directoryEntries.forEach(function(entry) {
            // === DEBUG: Log ALL entries ===
            console.log('DIR ENTRY:', {
                name: entry.name,
                type: entry.type === 1 ? 'FOLDER' : entry.type === 2 ? 'STREAM' : 'OTHER',
                size: entry.size
            });
            // === END DEBUG ===
            // Property streams are named "__substg1.0_XXXXYYYY"
            var isRootProperty = entry.name.indexOf('__substg1.0_') === 0;
            // Recipient properties are in a separate storage and handled later
            var isRecipientProperty = entry.name.indexOf('__recip_version1.0_') > -1;

            if (isRootProperty && !isRecipientProperty) {
                var propTag = "00000000";
                 if (entry.name.length >= 20) {
                    // Standard name: __substg1.0_XXXXYYYY
                    propTag = entry.name.substring(entry.name.length - 8);
                 } else {
                    // Fallback for shorter names: __substg1.0_XXXXYYYY
                    var parts = entry.name.split('_');
                    if (parts.length >= 3) {
                        propTag = parts[2];
                    }
                 }

                // YYYY = Property Type, XXXX = Property ID
                var propId = parseInt(propTag.substring(0, 4), 16);
                var propType = parseInt(propTag.substring(4, 8), 16);
                
                // --- FIX v1.4.15 ---
                // Check if this property ID has already been read.
                // This prevents a bad stream (e.g., binary) from overwriting
                // a good stream (e.g., text) that has the same ID.
                if (rawProperties[propId]) {
                    console.log('  Skipping duplicate property for id:', '0x' + propId.toString(16));
                    return; // 'return' acts as 'continue' in a forEach
                }
                // --- END FIX ---
    
                var streamData = self.readStream(entry);
                // === DEBUG: Log property details ===
                console.log('  PROPERTY:', {
                tag: propTag,
                id: '0x' + propId.toString(16),
                type: '0x' + propType.toString(16),
                size: streamData.length,
                first20bytes: Array.from(streamData.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')
                });
                // === END DEBUG ===
                // --- (Mode C/D) Store raw data first ---
                rawProperties[propId] = {
                    id: propId,
                    type: propType,
                    data: streamData // Store raw Uint8Array
                };
            }
        });
        
        // --- (Mode C/D) Process properties ---
        // This ensures we can process bodyHTML *before* body,
        // and then re-process bodyHTML to populate body if needed.
        
        var bodyHtmlProp = rawProperties[PROP_ID_HTML_BODY];
        if (bodyHtmlProp) {
            this.properties[PROP_ID_HTML_BODY] = {
                id: bodyHtmlProp.id,
                type: bodyHtmlProp.type,
                value: this.convertPropertyValue(bodyHtmlProp.data, bodyHtmlProp.type, bodyHtmlProp.id)
            };
        }
        
        var bodyProp = rawProperties[PROP_ID_BODY];
        if (bodyProp) {
            this.properties[PROP_ID_BODY] = {
                id: bodyProp.id,
                type: bodyProp.type,
                value: this.convertPropertyValue(bodyProp.data, bodyProp.type, bodyProp.id)
            };
        }
        
        // --- (Mode C/D) Fallback: Populate body from bodyHTML if body is empty ---
        var body = this.properties[PROP_ID_BODY] ? this.properties[PROP_ID_BODY].value : null;
        var bodyHtml = this.properties[PROP_ID_HTML_BODY] ? this.properties[PROP_ID_HTML_BODY].value : null;

        if ((!body || body.length === 0) && bodyHtml && bodyHtml.length > 0) {
            console.log("Body is empty, stripping from bodyHTML...");
            // Re-use the raw data from bodyHTML, but process it as PROP_ID_BODY
            // to trigger the HTML stripping and normalization logic.
            this.properties[PROP_ID_BODY] = {
                id: PROP_ID_BODY,
                type: bodyHtmlProp.type, // Use the original type
                value: this.convertPropertyValue(bodyHtmlProp.data, bodyHtmlProp.type, PROP_ID_BODY)
            };
        }
        
        // --- Process all other properties ---
        for (var propId in rawProperties) {
            // Skip properties we've already processed
            if (propId == PROP_ID_BODY || propId == PROP_ID_HTML_BODY) {
                continue;
            }

            var prop = rawProperties[propId];
            
            // --- (Mode E) Skip unused sender properties ---
            // if (prop.id === PROP_ID_SENDER_NAME || prop.id === PROP_ID_SENDER_EMAIL) {
            //     continue;
            // }
            // --- End (Mode E) ---

            this.properties[prop.id] = {
                id: prop.id,
                type: prop.type,
                value: this.convertPropertyValue(prop.data, prop.type, prop.id)
            };
        }
        
        
        // --- Fallback for empty OLE streams ---
        // In some O365 files, OLE streams are empty, but data exists in MIME text.
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
    
        // After all main properties are read, extract recipients
        this.extractRecipients();
    
        console.log('Total properties extracted:', Object.keys(this.properties).length);
    };

    /**
     * Converts raw stream data into a JavaScript value based on its MAPI type.
     * @param {Uint8Array} data - The raw data from the property stream.
     * @param {number} type - The MAPI property type (e.g., 0x001F for Unicode).
     * @param {number} propId - The MAPI property ID (used for heuristics).
     * @returns {*} The converted JavaScript value.
     */
    MsgReader.prototype.convertPropertyValue = function(data, type, propId) {
        if (!data || data.length === 0) {
            return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        
        var isBody = (propId === PROP_ID_BODY);
        var isHtmlBody = (propId === PROP_ID_HTML_BODY);
        var isTextProp = (type === PROP_TYPE_STRING || type === PROP_TYPE_STRING8);

        // --- (Mode C/D) Refactored Text/Binary processing ---
        // Process any property that is (or could be) text
        if (isBody || isHtmlBody || isTextProp || (type === PROP_TYPE_BINARY && data.length > 0)) {
            
            if (isBody || isHtmlBody) {
                console.log('=== BODY DEBUG ===');
                console.log('propId:', propId.toString(16), isBody ? '(BODY)' : '(HTML)');
                console.log('type:', type.toString(16));
                console.log('data length:', data.length);
                console.log('First 50 bytes (hex):', Array.from(data.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                console.log('First 50 bytes (as chars):', Array.from(data.slice(0, 50)).map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join(''));
            }
            var textUtf16 = null;
            var textUtf8 = null;
            var chosenText = null;

            // 1. Try UTF-16LE (common for .oft)
            try { textUtf16 = dataViewToString(view, 'utf16le'); } catch (e) {}

            // 2. Try UTF-8 (common for .msg)
            try { textUtf8 = dataViewToString(view, 'utf-8'); } catch (e) {}
            
            // 3. Heuristic: Decide which is better
            // (v1.4.13) Check printable character ratio
            var printableRatio = (s) => {
                if (!s || s.length === 0) return 0;
                // Check for common non-ASCII printable chars too
                return s.replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF]/g, '').length / s.length;
            };

            var ratioUtf16 = printableRatio(textUtf16);
            var ratioUtf8 = printableRatio(textUtf8);

            // Favor UTF-16LE if it's significantly better or if types match
            if (type === PROP_TYPE_STRING8 && ratioUtf16 > 0.7) {
                 chosenText = textUtf16;
            }
            // Favor UTF-8 if it's significantly better or if types match
            else if (type === PROP_TYPE_STRING && ratioUtf8 > 0.7) {
                 chosenText = textUtf8;
            }
            // Fallback heuristic if types are wrong (e.g. BINARY)
            else if (ratioUtf16 > ratioUtf8 && ratioUtf16 > 0.7) {
                chosenText = textUtf16;
            } else if (ratioUtf8 > ratioUtf16 && ratioUtf8 > 0.7) {
                chosenText = textUtf8;
            } else {
                // If both are bad, or equal, pick based on original type
                chosenText = (type === PROP_TYPE_STRING8) ? textUtf16 : textUtf8;
            }
            
            // 4. Sanitize based on property ID
            if (isBody) {
                // For PROP_ID_BODY, we want plain text.
                // This means we strip HTML and normalize.
                return _normalizeText(_stripHtml(chosenText));
            } else if (isHtmlBody) {
                // For PROP_ID_HTML_BODY, we just want the HTML as-is.
                return chosenText;
            }
            
            // 5. If it wasn't a body prop but was text-like, return the text
            if (isTextProp) {
                return chosenText;
            }
            
            // 6. If it was PROP_TYPE_BINARY (and not a body prop), return raw data
            if (type === PROP_TYPE_BINARY) {
                return data;
            }
        }
        // --- END (Mode C/D) ---

        switch (type) {
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

            default:
                // Return raw data for unknown types
                return data;
        }
    };
    

    /**
     * Safely parses an email address string, which might be in formats like
     * "Name <email@domain.com>" or just "email@domain.com".
     * v1.4.9: Made more robust to handle corrupt strings.
     * @param {string} addr - The address string to parse.
     * @returns {{name: string, email: string}}
     */
    function parseAddress(addr) {
        if (!addr) return { name: '', email: null }; // (Mode C) Handle null input
        addr = addr.trim();
        var email = addr;
        var name = addr;

        // 1. Check for "Name <email>" format
        var match = addr.match(/^(.*)<([^>]+)>$/);
        if (match) {
            name = match[1].trim().replace(/^"|"$/g, '');
            email = match[2].trim();
        }

        // 2. Check for just an email. Use regex to find *first* valid email.
        // This will find 'foo@bar.com' in 'foo@bar.com.' or 'foo@bar.com (Junk)'
        var emailMatch = email.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
        
        if (emailMatch) {
            email = emailMatch[0]; // Extracted the clean email
            // If name is still the full, dirty string, clean it
            if (name === addr) {
                // If the name was just the email, set it to blank
                if (name === email) {
                    name = '';
                } else {
                    // Try to clean up the name part
                    name = name.replace(email, '').trim();
                }
            }
        } else {
            // Not a valid email format
            email = null;
        }

        return { name: name, email: email };
    }

    /**
     * Extracts recipient information using a multi-layered approach for robustness.
     * v1.4.9: Removed de-duplication to support TO/CC duplicates.
     */
    MsgReader.prototype.extractRecipients = function() {
        var self = this;
        var recipients = []; // <-- FIX: No longer a map, just an array
    
        console.log('Extracting recipients...');
    
        // --- Method 1: OLE Recipient Storages ---
        // This is the "correct" way, reading from `__recip_version1.0_...` storages.
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
            // Perform a tree walk (DFS) to find all property streams under this recipient storage
            console.log('  Looking for properties for storage:', recipStorageName, 'starting at childId:', recipStorage.childId);
            
            var stack = [recipStorage.childId]; // Start with the storage's child
            var visited = new Set();
            var maxProps = 100; // Safety break
            var propsFound = 0;

            while (stack.length > 0 && propsFound < maxProps) {
                var entryId = stack.pop();

                if (entryId === -1 || entryId === 0xFFFFFFFF || !entryId || visited.has(entryId)) {
                    continue;
                }
                visited.add(entryId);

                var entry = self.directoryEntries[entryId];
                if (!entry) {
                    console.warn('  Invalid entry ID in tree walk:', entryId);
                    continue;
                }

                // If this is a property stream, read it
                if (entry.type === 2 && entry.name.indexOf('__substg1.0_') > -1) {
                    propsFound++;
                    var propTag = "00000000";
                    if (entry.name.length >= 20) {
                        propTag = entry.name.substring(entry.name.length - 8);
                    } else {
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
    
                    // Assign properties to our recipient object
                    switch(propId) {
                        case PROP_ID_RECIPIENT_DISPLAY_NAME: // 0x3001
                            recipient.name = value || recipient.name;
                            break;
                        case PROP_ID_RECIPIENT_EMAIL_ADDRESS: // 0x3003
                        case PROP_ID_RECIPIENT_SMTP_ADDRESS: // 0x39FE
                            // Prefer SMTP address if available
                            recipient.email = value || recipient.email;
                            break;
                        case PROP_ID_RECIPIENT_TYPE: // 0x0C15
                            if (typeof value === 'number') {
                                recipient.recipientType = value;
                            }
                            break;
                    }
                }

                // Add siblings and children to stack for full tree traversal
                if (entry.leftSiblingId !== -1 && entry.leftSiblingId < self.directoryEntries.length && !visited.has(entry.leftSiblingId)) {
                    stack.push(entry.leftSiblingId);
                }
                if (entry.rightSiblingId !== -1 && entry.rightSiblingId < self.directoryEntries.length && !visited.has(entry.rightSiblingId)) {
                    stack.push(entry.rightSiblingId);
                }
                if (entry.childId !== -1 && entry.childId < self.directoryEntries.length && !visited.has(entry.childId)) {
                    stack.push(entry.childId);
                }
            }
    
            if (recipient.name || recipient.email) {
                // Fallback: If email is missing but name is an email, use it
                if (!recipient.email && recipient.name && recipient.name.indexOf('@') > -1) {
                    recipient.email = recipient.name;
                }
                // Fallback: If name is missing but email is present, use email as name
                if (!recipient.name && recipient.email) {
                    recipient.name = recipient.email;
                }
                
                // FIX v1.4.9: Just push, do not de-duplicate
                if (recipient.email) {
                    console.log('  Adding recipient from OLE tree:', recipient);
                    recipients.push(recipient);
                }
            }
        });
    
        // --- Fallback Method 2: MIME Header Scan ---
        var mimeData = this._scanBufferForMimeText();
        console.log('MIME Scan Fallback Data:', mimeData);
        
        // This logic is now complex, as we can't use a map.
        // We will prioritize Method 3 (Display Fields) as it's more reliable
        // than Method 2 (MIME) for this file, as Method 2 is empty.
        // If Method 2 *did* have data, we would iterate the recipients array
        // and update types, similar to Method 3.

        // --- Fallback Method 3: OLE Display Fields ---
        console.log('Running fallback recipient extraction (Method 3 - Display Fields)...');
        var displayTo = self.properties[PROP_ID_DISPLAY_TO] ? self.properties[PROP_ID_DISPLAY_TO].value : null;
        var displayCc = self.properties[PROP_ID_DISPLAY_CC] ? self.properties[PROP_ID_DISPLAY_CC].value : null;
        var displayBcc = self.properties[PROP_ID_DISPLAY_BCC] ? self.properties[PROP_ID_DISPLAY_BCC].value : null;

        // Create clean lists of emails from the Display fields
        var displayToEmails = [];
        var displayCcEmails = [];
        var displayBccEmails = [];
        
        if (displayTo) {
            displayTo.split(';').forEach(function(addrStr) {
                var parsed = parseAddress(addrStr);
                if (parsed.email) {
                    displayToEmails.push(parsed.email.toLowerCase());
                }
            });
        }
        if (displayCc) {
            displayCc.split(';').forEach(function(addrStr) {
                var parsed = parseAddress(addrStr);
                if (parsed.email) {
                    displayCcEmails.push(parsed.email.toLowerCase());
                }
            });
        }
        if (displayBcc) {
            displayBcc.split(';').forEach(function(addrStr) {
                var parsed = parseAddress(addrStr);
                if (parsed.email) {
                    displayBccEmails.push(parsed.email.toLowerCase());
                }
            });
        }

        console.log('DisplayField TO emails:', displayToEmails);
        console.log('DisplayField CC emails:', displayCcEmails);
        
        // * --- FIX 1.4.10: Implement counting logic for accurate recipient classification --- *
        
        // Build counters
        var toEmailCounts = {};
        var ccEmailCounts = {};
        var bccEmailCounts = {}; // Also count BCC for completeness

        displayToEmails.forEach(function(email) {
            toEmailCounts[email] = (toEmailCounts[email] || 0) + 1;
        });

        displayCcEmails.forEach(function(email) {
            ccEmailCounts[email] = (ccEmailCounts[email] || 0) + 1;
        });
        
        displayBccEmails.forEach(function(email) {
            bccEmailCounts[email] = (bccEmailCounts[email] || 0) + 1;
        });
        
        // Apply to recipients
        recipients.forEach(function(recipient) {
            // Ensure email exists before trying toLower
            if (!recipient.email) return; 
            
            var emailKey = recipient.email.toLowerCase();
            
            // Check if this email has remaining CC slots
            if (ccEmailCounts[emailKey] && ccEmailCounts[emailKey] > 0) {
                console.log('Updating recipient from Display Field (Cc):', emailKey);
                recipient.recipientType = RECIPIENT_TYPE_CC;
                ccEmailCounts[emailKey]--;
            }
            // Check if this email has remaining TO slots
            else if (toEmailCounts[emailKey] && toEmailCounts[emailKey] > 0) {
                console.log('Updating recipient from Display Field (To):', emailKey);
                recipient.recipientType = RECIPIENT_TYPE_TO;
                toEmailCounts[emailKey]--;
            }
            // Check if this email has remaining BCC slots
            else if (bccEmailCounts[emailKey] && bccEmailCounts[emailKey] > 0) {
                console.log('Updating recipient from Display Field (Bcc):', emailKey);
                recipient.recipientType = RECIPIENT_TYPE_BCC;
                bccEmailCounts[emailKey]--;
            }
            // Else, it remains the default (TO) or whatever Method 1 found
        });


        // Note: This logic does not *add* recipients from Display Fields if they
        // were missing from Method 1. This is safer, as Method 1 is the
        // source of truth for *who* recipients are, and Method 3 is the
        // source of truth for *what type* they are.

        console.log('Total recipients extracted:', recipients.length);
        
        // Store the final recipient list
        this.properties['recipients'] = {
            id: 0,
            type: 0,
            value: recipients
        };
    };

    /**
     * Public helper to get a field value by its common name.
     * @param {string} fieldName - The common name ('subject', 'body', 'senderName', etc.).
     * @returns {*} The value of the field, or null if not found.
     */
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
            case 'recipients':
                // Recipients are stored differently
                return this.properties['recipients'] ? this.properties['recipients'].value : [];
            default:
                return null;
        }

        var prop = this.properties[propId];
        return prop ? prop.value : null;
    };

    // --- Public API ---
    // Expose a single `read` function
    return {
        /**
         * Reads and parses an MSG/OFT/EML file.
         * Auto-detects the file type and uses the correct parser.
         * @param {ArrayBuffer|Uint8Array|Array} arrayBuffer - The file data.
         * @returns {object} An object containing the parsed fields.
         */
        read: function(arrayBuffer) {
            var reader = new MsgReader(arrayBuffer);
            
            // --- v1.4.16 File Sniffing Logic ---
            if (reader.dataView.byteLength < 8) {
                // Too small to be OLE, but could be a tiny MIME file.
                // Let's default to MIME parser for very small files.
                console.warn('File is very small, attempting to parse as MIME/EML...');
                return reader.parseMime();
            }
            
            // Check OLE signature: 0xD0CF11E0A1B11AE1
            var sig1 = reader.dataView.getUint32(0, true);
            var sig2 = reader.dataView.getUint32(4, true);

            if (sig1 === 0xE011CFD0 && sig2 === 0xE11AB1A1) {
                // It's an OLE file (.msg / .oft)
                console.log('OLE signature found. Parsing as MSG/OFT...');
                return reader.parse(); // The original OLE parser
            } else {
                // It's not OLE. Assume MIME (.eml / .email)
                console.log('OLE signature NOT found. Parsing as MIME/EML...');
                return reader.parseMime(); // The new MIME parser
            }
        }
    };
}));

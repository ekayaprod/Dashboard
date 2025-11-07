/**
 * msg-reader.js v1.4.9
 * Production-grade Microsoft Outlook MSG and OFT file parser
 *
 * This script provides a pure JavaScript parser for Microsoft Outlook .msg and .oft
 * files. It is designed to be robust, handling various formats including Outlook 365
 * hybrid files. It extracts key information such as subject, body (text and HTML),
 * sender, and recipients.
 *
 * Based on the original msg.reader by Peter Theill.
 * Licensed under MIT.
 *
 * CHANGELOG:
 * v1.4.9:
 * 1. [FIX] Removed `recipientMap` de-duplication logic. This fixes the
 * bug where an email present in both TO and CC fields was only
 * assigned to one.
 * 2. [FIX] Method 1 (OLE) now builds a simple array, allowing duplicate emails.
 * 3. [FIX] Method 3 (Display Fields) now iterates the array to *correct*
 * recipient types, rather than adding/overwriting map entries.
 *
 * v1.4.8:
 * 1. [FIX] Method 3 (Display Fields) will now CORRECT the recipientType
 * for recipients found by Method 1.
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
    var PROP_ID_SENDER_NAME = 0x0C1A; // PidTagSenderName
    var PROP_ID_SENDER_EMAIL = 0x5D01; // PidTagSenderSmtpAddress
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
            // console.warn('Failed to parse date:', e);
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
     * Initiates the parsing of the MSG file.
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
                senderName: this.getFieldValue('senderName'),
                senderEmail: this.getFieldValue('senderEmail'),
                recipients: this.getFieldValue('recipients')
            };
        } catch (e) {
            // console.error('MSG parsing error:', e);
            throw new Error('Failed to parse MSG file: ' + e.message);
        }
    };

    /**
     * Reads the OLE (Compound File Binary Format) header.
     */
    MsgReader.prototype.readHeader = function() {
        // The OLE header is 512 bytes
        if (this.buffer.byteLength < 512) {
            throw new Error('File too small to be valid MSG file');
        }

        // Check OLE signature: 0xD0CF11E0A1B11AE1
        var sig1 = this.dataView.getUint32(0, true);
        var sig2 = this.dataView.getUint32(4, true);
        
        if (sig1 !== 0xE011CFD0 || sig2 !== 0xE11AB1A1) {
            throw new Error('Invalid MSG file signature');
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

        // console.log('MSG Header:', this.header);
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

        // console.log('FAT entries:', this.fat.length);
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
                 // console.warn('MiniFAT sector chain error: sector index out of bounds.');
                 break; // Sector index out of bounds, chain is broken
            }
            sector = this.fat[sector]; // Find next MiniFAT sector in the main FAT
            sectorsRead++;
        }

        // console.log('MiniFAT entries:', this.miniFat.length);
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
                 // console.warn('Directory sector chain error: sector index out of bounds.');
                 break; // Sector index out of bounds, chain is broken
            }
            sector = this.fat[sector]; // Find next directory sector in the main FAT
            sectorsRead++;
        }

        // console.log('Directory entries:', this.directoryEntries.length);
        
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
                // console.warn('Root entry not found for MiniFAT stream');
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
                    // console.warn('MiniFAT sector chain error: sector index out of bounds.');
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
                    // console.warn('FAT sector chain error: sector index out of bounds.');
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

        // console.log('Scanning raw buffer for MIME text fallback...');
        var rawText = '';
        try {
            // Try UTF-8 first, as it's common
            rawText = new TextDecoder('utf-8', { fatal: false }).decode(this.dataView);
        } catch (e) {
            // Fallback to latin1 (which handles arbitrary bytes)
            try {
                rawText = new TextDecoder('latin1').decode(this.dataView);
            } catch (e2) {
                // console.warn('Could not decode raw buffer for MIME scan.');
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
            // console.log('MIME Fallback found Subject:', result.subject);
        }

        var toMatch = rawText.match(/\bTo:\s*([^\r\n]+)/i);
        if (toMatch) {
            result.to = toMatch[1].trim();
            // console.log('MIME Fallback found To:', result.to);
        }

        var ccMatch = rawText.match(/\bCc:\s*([^\r\n]+)/i);
        if (ccMatch) {
            result.cc = ccMatch[1].trim();
            // console.log('MIME Fallback found Cc:', result.cc);
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
            // console.log('MIME Fallback found Body (first 50 chars):', result.body ? result.body.substring(0, 50) : 'null');
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
    
        // console.log('Extracting properties from', this.directoryEntries.length, 'entries...');
    
        // Find all property streams
        this.directoryEntries.forEach(function(entry) {
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
    
                var streamData = self.readStream(entry);
                var value = self.convertPropertyValue(streamData, propType, propId);
    
                // console.log('Property', propId.toString(16), 'type', propType.toString(16), '=', 
                //             typeof value === 'string' ? value.substring(0, 50) : (value instanceof Uint8Array ? "Uint8Array(" + value.length + ")" : value));
    
                self.properties[propId] = {
                    id: propId,
                    type: propType,
                    value: value
                };
            }
        });
        
        // --- Fallback for empty OLE streams ---
        // In some O365 files, OLE streams are empty, but data exists in MIME text.
        var mimeData = this._scanBufferForMimeText();
        
        if (!this.properties[PROP_ID_SUBJECT] || !this.properties[PROP_ID_SUBJECT].value) {
            if (mimeData.subject) {
                 // console.log('Applying MIME fallback for Subject');
                 this.properties[PROP_ID_SUBJECT] = { id: PROP_ID_SUBJECT, type: PROP_TYPE_STRING, value: mimeData.subject };
            }
        }
        if (!this.properties[PROP_ID_BODY] || !this.properties[PROP_ID_BODY].value) {
            if (mimeData.body) {
                // console.log('Applying MIME fallback for Body');
                this.properties[PROP_ID_BODY] = { id: PROP_ID_BODY, type: PROP_TYPE_STRING, value: mimeData.body };
            }
        }
    
        // After all main properties are read, extract recipients
        this.extractRecipients();
    
        // console.log('Total properties extracted:', Object.keys(this.properties).length);
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

        // Special handling for OFT body, which is stored as binary but is text
        if (type === PROP_TYPE_BINARY && (propId === PROP_ID_BODY || propId === PROP_ID_HTML_BODY)) {
            // console.log('Binary body property detected, forcing text conversion...');
            // Try UTF-8 first, as it's common in modern files
            var text = dataViewToString(view, 'utf-8');
            if (text.indexOf('<') > -1 && text.indexOf('>') > -1) {
                // console.log('  Detected UTF-8 body');
                return text; // Basic heuristic: if it contains HTML tags, it's probably right.
            }
            // Fallback to UTF-16LE
            text = dataViewToString(view, 'utf16le');
            if (text.length > 0) {
                // console.log('  Detected UTF-16LE body');
                return text;
            }
            // If both fail, return the raw data
            return data;
        }

        switch (type) {
            case PROP_TYPE_STRING8: // 0x001F (PT_UNICODE / UTF-16LE string)
                return dataViewToString(view, 'utf16le');

            case PROP_TYPE_STRING: // 0x001E (PT_STRING8 / ASCII/UTF-8 string)
                // This type is often used for UTF-8 in modern files.
                return dataViewToString(view, 'utf-8');

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
                // Check if this binary data looks like text, as types can be wrong.
                if (this.looksLikeText(data)) {
                    // console.log('Binary data for prop ' + (propId ? propId.toString(16) : 'N/A') + ' looks like text, converting...');
                    // Try UTF-8 first
                    var text = dataViewToString(view, 'utf-8');
                    if (text && text.length > 0 && text.replace(/[^\x20-\x7E\n\r\t]/g, '').length > text.length * 0.5) {
                        // console.log('  Detected UTF-8');
                        return text;
                    }
                    // Try UTF-16LE
                    text = dataViewToString(view, 'utf16le');
                    if (text && text.length > 0 && text.replace(/[^\x20-\x7E\n\r\t]/g, '').length > text.length * 0.5) {
                        // console.log('  Detected UTF-16LE');
                        return text;
                    }
                }
                return data; // Return as raw Uint8Array

            default:
                // Unknown type - apply text-detection heuristic
                if (this.looksLikeText(data)) {
                    var text = dataViewToString(view, 'utf-16le');
                    if (text && text.length > 0) {
                        return text;
                    }
                }
                return data;
        }
    };
    
    /**
     * Heuristic check to see if binary data is likely text.
     * @param {Uint8Array} data - The binary data.
     * @returns {boolean} True if the data seems to be text.
     */
    MsgReader.prototype.looksLikeText = function(data) {
        if (!data || data.length < 4) {
            return false;
        }

        var printableCount = 0;
        var totalChecked = Math.min(100, data.length);
        
        if (totalChecked === 0) return false;

        for (var i = 0; i < totalChecked; i++) {
            var byte = data[i];
            // Check for printable ASCII, whitespace, or null (common in UTF-16)
            if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x0A || byte === 0x0D || byte === 0x09 || byte === 0x00) {
                printableCount++;
            }
        }

        // If > 70% of the first 100 bytes are "text-like", treat it as text.
        return (printableCount / totalChecked) > 0.7;
    };

    /**
     * Safely parses an email address string, which might be in formats like
     * "Name <email@domain.com>" or just "email@domain.com".
     * v1.4.9: Made more robust to handle corrupt strings.
     * @param {string} addr - The address string to parse.
     * @returns {{name: string, email: string}}
     */
    function parseAddress(addr) {
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
    
        // console.log('Extracting recipients...');
    
        // --- Method 1: OLE Recipient Storages ---
        // This is the "correct" way, reading from `__recip_version1.0_...` storages.
        var recipientStorages = this.directoryEntries.filter(function(entry) {
            return entry.type === 1 && entry.name.indexOf('__recip_version1.0_') === 0;
        });
    
        // console.log('Found recipient storages:', recipientStorages.length);
    
        recipientStorages.forEach(function(recipStorage) {
            var recipient = {
                recipientType: RECIPIENT_TYPE_TO, // Default to TO
                name: '',
                email: ''
            };
    
            var recipStorageName = recipStorage.name;
            // Perform a tree walk (DFS) to find all property streams under this recipient storage
            // console.log('  Looking for properties for storage:', recipStorageName, 'starting at childId:', recipStorage.childId);
            
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
                    // console.warn('  Invalid entry ID in tree walk:', entryId);
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
    
                    // console.log('    Found prop:', { name: entry.name, propId: propId.toString(16), value: (typeof value === 'string' ? value.substring(0, 50) : value) });
    
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
                    // console.log('  Adding recipient from OLE tree:', recipient);
                    recipients.push(recipient);
                }
            }
        });
    
        // --- Fallback Method 2: MIME Header Scan ---
        var mimeData = this._scanBufferForMimeText();
        // console.log('MIME Scan Fallback Data:', mimeData);
        
        // This logic is now complex, as we can't use a map.
        // We will prioritize Method 3 (Display Fields) as it's more reliable
        // than Method 2 (MIME) for this file, as Method 2 is empty.
        // If Method 2 *did* have data, we would iterate the recipients array
        // and update types, similar to Method 3.

        // --- Fallback Method 3: OLE Display Fields ---
        // console.log('Running fallback recipient extraction (Method 3 - Display Fields)...');
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

        // console.log('DisplayField TO emails:', displayToEmails);
        // console.log('DisplayField CC emails:', displayCcEmails);
        
        // Now, iterate the recipients array from Method 1 and correct their types
        recipients.forEach(function(recipient) {
            var emailKey = recipient.email.toLowerCase();
            
            // Check CC first, as it's the more specific case (overwrites TO default)
            if (displayCcEmails.indexOf(emailKey) > -1) {
                // console.log('Updating recipient from Display Field (Cc):', emailKey);
                recipient.recipientType = RECIPIENT_TYPE_CC;
            } 
            // Check TO
            else if (displayToEmails.indexOf(emailKey) > -1) {
                // console.log('Updating recipient from Display Field (To):', emailKey);
                recipient.recipientType = RECIPIENT_TYPE_TO;
            }
            // Check BCC
            else if (displayBccEmails.indexOf(emailKey) > -1) {
                // console.log('Updating recipient from Display Field (Bcc):', emailKey);
                recipient.recipientType = RECIPIENT_TYPE_BCC;
            }
            // Else, it remains the default (TO) or whatever Method 1 found
        });


        // Note: This logic does not *add* recipients from Display Fields if they
        // were missing from Method 1. This is safer, as Method 1 is the
        // source of truth for *who* recipients are, and Method 3 is the
        // source of truth for *what type* they are.

        // console.log('Total recipients extracted:', recipients.length);
        
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
            case 'senderName':
                propId = PROP_ID_SENDER_NAME;
                break;
            case 'senderEmail':
                propId = PROP_ID_SENDER_EMAIL;
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
         * Reads and parses an MSG file.
         * @param {ArrayBuffer|Uint8Array|Array} arrayBuffer - The MSG file data.
         * @returns {object} An object containing the parsed fields.
         */
        read: function(arrayBuffer) {
            var reader = new MsgReader(arrayBuffer);
            return reader.parse();
        }
    };
}));
    </script>
    
    <script>
    // ===================================================================
    // CONSTANTS & HELPERS (Issue 1, 10, 13, 15)
    // ===================================================================
    
    // C15: Global constant for file size limit
    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

    // Issue 1: Centralized MailTo field names
    const MAILTO_FIELDS = ['to', 'cc', 'bcc', 'subject', 'body'];

    // Issue 10: Extracted Icon SVGs
    const ICONS = {
        folder: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.54 3.87.5 3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.07L6.2 7H1.12zM0 4.25a.5.5 0 0 1 .5-.5h6.19l.74 1.85a.5.5 0 0 1 .44.25h4.13a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5zM.5 7a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5z"/></svg>',
        /* * BUG FIX 1: Corrected SVG path data. 
         * The string ".I-" was replaced with ".79l-" to fix the syntax error.
         */
        template: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586zm.15-1.4-1.291.79l-4.276 2.624V4.697l5.562 3.42zM16 4.697v7.104l-5.803-3.558zM9.031 8.83l1.291.79 4.276 2.624V4.697l-5.562 3.42z"/></svg>'
    };

    // Issue 13: Extracted CSV path validation regex
    const CSV_PATH_REGEX = /^\/[\w\s\/-]*$/;

    // Issue 15: Centralized duplicate validation
    /**
     * Checks for a duplicate item in a container and shows a validation error if found.
     * @param {Array} container - The array of items/folders (children).
     * @param {string} name - The name to check.
     * @param {string} errorContext - The context for the error message ('folder' or 'item').
     * @param {string} inputId - The ID of the input field to highlight.
     * @returns {boolean} True if a duplicate exists, false otherwise.
     */
    const validateUniqueInContainer = (container, name, errorContext, inputId) => {
         if (DataValidator.hasDuplicate(container, 'name', name)) {
             SafeUI.showValidationError('Duplicate Name', 'An ' + errorContext + ' with this name already exists in this folder.', inputId);
             return true;
        }
        return false;
    };

    // Dependency Check
    (() => {
        // REFACTOR: Added SharedSettingsModal to dependency check
        // REMOVED: SimpleMsgParser from dependency check
        const dependencies = ['SafeUI', 'UIPatterns', 'ListRenderer', 'SearchHelper', 'BackupRestore', 'DataValidator', 'DataConverter', 'CsvManager', 'SharedSettingsModal', 'MsgReader'];
        const missing = dependencies.filter(dep => typeof window[dep] === 'undefined');
        
        // REFACTOR: Changed check for MsgReader to be 'object' (not 'function')
        // and check for its 'read' method.
        if (typeof window.MsgReader !== 'object' || typeof window.MsgReader.read !== 'function') {
            if (!missing.includes('MsgReader')) {
                // If it was loaded but isn't the correct structure, mark it as missing
                missing.push('MsgReader (Invalid Type)');
            }
        }
        
        // REMOVED: Check for SimpleMsgParser


        if (missing.length > 0) {
            const errorTitle = "Application Failed to Load";
            const errorMessage = `One or more required JavaScript files (e.g., app-core.js, msgreader.js) failed to load, or core modules are missing. Missing: ${missing.join(', ')}`;
            
            if (typeof window.AppLifecycle !== 'undefined' && typeof window.AppLifecycle._showErrorBanner === 'function') {
                window.AppLifecycle._showErrorBanner(errorTitle, errorMessage);
            } else {
                const banner = document.getElementById('app-startup-error');
                if(banner) {
                    banner.innerHTML = `<strong>${errorTitle}</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">${errorMessage}</p>`;
                    banner.classList.remove('hidden');
                }
            }
            throw new Error(`Critical dependencies missing: ${missing.join(', ')}`);
        }
    })();


    AppLifecycle.run(async () => {
    
        const APP_CONFIG = {
            NAME: 'mailto_library',
            VERSION: '1.2.2', // Updated version
            DATA_KEY: 'mailto_library_v1',
            CSV_HEADERS: ['name', 'path', ...MAILTO_FIELDS] // Issue 1
        };

        const defaultState = {
            version: APP_CONFIG.VERSION,
            library: [] 
        };
    
        const ctx = await AppLifecycle.initPage({
            storageKey: APP_CONFIG.DATA_KEY,
            defaultState: defaultState,
            version: APP_CONFIG.VERSION,
            requiredElements: [
                'navbar-container', 'toast', 'modal-overlay', 'modal-content',
                'catalogue-view', 'editor-view', 
                'btn-new-template', 'btn-new-folder', 
                'btn-settings', 
                'breadcrumb-container', 'tree-list-container', 
                'btn-editor-cancel', 'btn-generate', 
                'upload-wrapper', 'msg-upload', 
                'result-to', 'result-cc', 'result-bcc', 'result-subject', 'result-body', 
                'output-wrapper', 'result-link', 'result-mailto', 'copy-mailto-btn', 
                'save-template-name', 'btn-save-to-library' 
            ]
        });
    
        if (!ctx || !ctx.elements) {
            console.error('AppLifecycle failed to initialize context or DOM elements.');
            return;
        }
    
        const { elements: DOMElements, state, saveState } = ctx;
        let currentFolderId = 'root'; 
        let currentMailtoCommand = null; 

        const clearEditorFields = () => {
            currentMailtoCommand = null;
            MAILTO_FIELDS.forEach(field => { 
                const element = DOMElements['result' + field.charAt(0).toUpperCase() + field.slice(1)];
                if (element) element.value = '';
            });
            DOMElements.saveTemplateName.value = '';
            DOMElements.outputWrapper.classList.add('hidden');
        };
        
        const hasUnsavedEditorChanges = () => {
            return currentMailtoCommand || MAILTO_FIELDS.some(field => {
                const element = DOMElements['result' + field.charAt(0).toUpperCase() + field.slice(1)];
                return element && element.value;
            });
        };
        
        const resizeResultBody = () => DOMHelpers.triggerTextareaResize(DOMElements.resultBody);
        const resizeResultMailto = () => DOMHelpers.triggerTextareaResize(DOMElements.resultMailto);

        const navigateToFolder = (id) => {
            currentFolderId = id;
            renderCatalogue();
        };

        const createFolderModalHTML = () => {
            return '<input id="folder-name-input" class="sidebar-input" placeholder="Folder Name">';
        };

        const handleTreeItemCopy = (item, copyBtn) => {
            const mailtoCommand = copyBtn.dataset.mailto;
            if (mailtoCommand && mailtoCommand !== 'undefined' && mailtoCommand !== 'null') {
                SafeUI.copyToClipboard(mailtoCommand);
                SafeUI.showToast(`Copied "${item.name}" to clipboard!`);
            } else {
                SafeUI.showToast('No command to copy from this template.');
            }
        };

        // REFACTOR: Modified to find the item's parent container for deletion
        const handleTreeItemDelete = (id, item) => {
            UIPatterns.confirmDelete(item.type, item.name, () => {
                // Find the parent container (folder) of the item to delete it
                const parent = findParentOfItem(id);
                if (parent) {
                    const index = parent.children.findIndex(i => i.id === id);
                    if (index > -1) {
                        parent.children.splice(index, 1);
                        saveState();
                        renderCatalogue();
                    }
                }
            });
        };
        
        // NEW FEATURE: Handle moving a template
        const handleTreeItemMove = (id, item) => {
            // 1. Generate list of possible target folders
            const folders = [];
            // Helper to recursively find folders
            function findFolders(container, path, currentFolderId) {
                // Add current folder
                folders.push({
                    id: currentFolderId,
                    name: path,
                    disabled: currentFolderId === findParentOfItem(id)?.id // Disable moving to current folder
                });
                // Find subfolders
                container.forEach(i => {
                    if (i.type === 'folder') {
                        findFolders(i.children, path + i.name + '/', i.id);
                    }
                });
            }
            
            // Find all folders starting from root
            findFolders(state.library, '/', 'root');

            // 2. Build Modal HTML
            const folderListHtml = folders.map(folder => `
                <li class="move-folder-item ${folder.disabled ? 'disabled' : ''}" data-folder-id="${SafeUI.escapeHTML(folder.id)}">
                    ${ICONS.folder} ${SafeUI.escapeHTML(folder.name)}
                </li>
            `).join('');

            const modalHtml = `
                <p>Move "<strong>${SafeUI.escapeHTML(item.name)}</strong>" to:</p>
                <ul class="move-folder-list">
                    ${folderListHtml}
                </ul>
            `;
            
            // 3. Show Modal
            SafeUI.showModal('Move Template', modalHtml, [{ label: 'Cancel' }]);
            
            // 4. Add listeners to the new folder list
            document.querySelector('.move-folder-list').addEventListener('click', (e) => {
                const targetFolderEl = e.target.closest('.move-folder-item');
                if (!targetFolderEl || targetFolderEl.classList.contains('disabled')) {
                    return;
                }
                
                const targetFolderId = targetFolderEl.dataset.folderId;
                
                // Find item's original parent and remove it
                const originalParent = findParentOfItem(id);
                if (!originalParent) return; // Should not happen
                
                const itemIndex = originalParent.children.findIndex(i => i.id === id);
                if (itemIndex === -1) return;
                
                // Remove item and get a reference to it
                const [itemToMove] = originalParent.children.splice(itemIndex, 1);
                
                // Find new parent and add it
                let newParentContainer;
                if (targetFolderId === 'root') {
                    newParentContainer = state.library;
                } else {
                    newParentContainer = findItemById(targetFolderId)?.children;
                }
                
                if (!newParentContainer) {
                    // Failsafe: put it back
                    originalParent.children.splice(itemIndex, 0, itemToMove);
                    return;
                }
                
                newParentContainer.push(itemToMove);
                
                saveState();
                renderCatalogue();
                SafeUI.hideModal();
                SafeUI.showToast('Template moved!');
            });
        };

        const handleDragEnterOver = (e) => {
            e.preventDefault();
            DOMElements.uploadWrapper.classList.add('dragover');
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            DOMElements.uploadWrapper.classList.remove('dragover');
        };

        const handleDrop = (e) => {
            e.preventDefault();
            DOMElements.uploadWrapper.classList.remove('dragover'); 
            const files = e.dataTransfer.files;
            if (files && files.length > 0) handleFile(files[0]);
        };


        // ===================================================================
        // CORE DATA FUNCTIONS
        // ===================================================================

        const parseMailto = (mailtoStr) => {
            const data = {};
            MAILTO_FIELDS.forEach(field => data[field] = ''); 

            if (!mailtoStr || !mailtoStr.startsWith('mailto:')) {
                return data;
            }
            
            if (!/^mailto:[^\s]*/.test(mailtoStr)) {
                return data;
            }

            try {
                const url = new URL(mailtoStr.replace(/ /g, '%20'));
                data.to = decodeURIComponent(url.pathname || '');
                MAILTO_FIELDS.slice(1).forEach(field => { 
                    data[field] = decodeURIComponent(url.searchParams.get(field) || '');
                });
                return data;
            } catch (e) {
                console.warn("Mailto string parsing failed:", mailtoStr, e);
                if (mailtoStr.indexOf('?') === -1) {
                     try { 
                        data.to = decodeURIComponent(mailtoStr.substring(7)); 
                     } catch { 
                        data.to = mailtoStr.substring(7);
                     }
                }
                return data;
            }
        };

        const buildMailto = (data) => {
            let mailto = 'mailto:';
            if (data.to) {
                const recipients = data.to.split(',').map(r => r.trim()).filter(Boolean);
                mailto += recipients.map(r => encodeURIComponent(r)).join(',');
            }
            
            const params = [];
            
            MAILTO_FIELDS.slice(1).forEach(field => { 
                 if (data[field]) {
                    if (field === 'body') {
                        const normalizedBody = data.body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                        const encodedBody = encodeURIComponent(normalizedBody).replace(/%0A/g, '%0D%0A');
                        params.push('body=' + encodedBody);
                    } else {
                        params.push(field + '=' + encodeURIComponent(data[field]));
                    }
                }
            });
            
            if (params.length > 0) {
                mailto += '?' + params.join('&');
            }
            return mailto;
        };

        const findItemById = (id, items = state.library, visited = new Set()) => {
            if (id === 'root') return { id: 'root', name: 'Root', children: state.library, path: '/' };
            for (const item of items) {
                if (visited.has(item.id)) continue; 
                visited.add(item.id); 

                if (item.id === id) return item;
                if (item.type === 'folder' && item.children) {
                    const found = findItemById(id, item.children, visited); 
                    if (found) return found;
                }
            }
            return null;
        };
        
        // NEW FEATURE: Helper to find the parent object of an item
        const findParentOfItem = (childId, parent = { id: 'root', children: state.library }, visited = new Set()) => {
            if (visited.has(parent.id)) return null;
            visited.add(parent.id);
            
            if (parent.children) {
                if (parent.children.some(child => child.id === childId)) {
                    return parent;
                }
                for (const item of parent.children) {
                    if (item.type === 'folder') {
                        const foundParent = findParentOfItem(childId, item, visited);
                        if (foundParent) return foundParent;
                    }
                }
            }
            return null;
        };
        
        const getItemsInCurrentFolder = () => {
            if (currentFolderId === 'root') {
                return state.library;
            }
            const folder = findItemById(currentFolderId);
            return folder ? folder.children : [];
        };

        const getBreadcrumbPath = (folderId) => {
            if (folderId === 'root') return [{ id: 'root', name: 'Root' }];

            const path = [];
            let targetItem = null;
            
            const visitedIds = new Set(); 
            let iterations = 0; 
            const maxIterations = state.library.length * 10; 

            const stack = state.library.map(item => [item, []]);

            while (stack.length > 0) {
                if (++iterations > maxIterations) { 
                    console.error("Breadcrumb path generation exceeded max iterations, circular reference suspected.");
                    break; 
                }

                const [currentItem, parentPath] = stack.pop();
                
                if (visitedIds.has(currentItem.id)) continue; 
                visitedIds.add(currentItem.id);

                const currentPath = [...parentPath, { id: currentItem.id, name: currentItem.name }];

                if (currentItem.id === folderId) {
                    targetItem = currentItem;
                    path.push(...currentPath);
                    break; 
                }

                if (currentItem.type === 'folder' && currentItem.children) {
                    for (let i = currentItem.children.length - 1; i >= 0; i--) {
                        stack.push([currentItem.children[i], currentPath]);
                    }
                }
            }
            
            path.unshift({ id: 'root', name: 'Root' });
            return path;
        };


        // ===================================================================
        // RENDER & VIEW FUNCTIONS
        // ===================================================================

        const renderBreadcrumbs = (path) => {
            const html = path.map((part, index) => {
                const escapedId = SafeUI.escapeHTML(part.id);
                const escapedName = SafeUI.escapeHTML(part.name);

                if (index === path.length - 1) {
                    return `<span class="breadcrumb-current">${escapedName}</span>`;
                } else {
                    return `<a class="breadcrumb-link" data-id="${escapedId}">${escapedName}</a><span class="breadcrumb-separator">&gt;</span>`;
                }
            }).join('');
            DOMElements.breadcrumbContainer.innerHTML = html;
        };

        // Main Render Function
        const renderCatalogue = () => {
            const path = getBreadcrumbPath(currentFolderId);
            renderBreadcrumbs(path);

            const items = getItemsInCurrentFolder();
            const sortedItems = [...items].sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return (a.name || '').localeCompare(b.name || '');
            });
            
            ListRenderer.renderList({
                container: DOMElements.treeListContainer,
                items: sortedItems,
                emptyMessage: "This folder is empty. Click 'New Template' to add one.",
                createItemElement: (item) => {
                    const div = document.createElement('div');
                    div.className = 'list-item';
                    div.dataset.id = item.id;
                    div.dataset.type = item.type;
                    
                    const iconType = item.type === 'folder' ? 'folder' : 'template';
                    const iconSvg = ICONS[iconType]; 
                    
                    let nameElement = '';
                    const escapedName = SafeUI.escapeHTML(item.name);

                    if (item.type === 'folder') {
                        nameElement = `<span class="list-item-name-folder">${escapedName}</span>`;
                    } else {
                        const escapedMailto = SafeUI.escapeHTML(item.mailto);
                        nameElement = `<a href="${escapedMailto}" class="list-item-name" title="Launch: ${escapedName}">${escapedName}</a>`;
                    }

                    // NEW FEATURE: Added Move button
                    const moveButton = item.type === 'item' ? 
                        `<button class="icon-btn move-btn" title="Move to...">${SVGIcons.pencil}</button>` : '';

                    div.innerHTML = `
                        <div class="list-item-icon ${iconType}">${iconSvg}</div>
                        ${nameElement}
                        <div class="list-item-actions">
                            ${item.type === 'item' ? `<button class="icon-btn copy-btn" title="Copy mailto: command" data-mailto="${SafeUI.escapeHTML(item.mailto)}">${SafeUI.SVGIcons.copy}</button>` : ''}
                            ${moveButton}
                            <button class="icon-btn delete-btn" title="Delete">${SafeUI.SVGIcons.trash}</button>
                        </div>
                    `;
                    return div;
                }
            });
        };

        const showView = (viewName) => {
            DOMElements.catalogueView.classList.toggle('active', viewName === 'catalogue');
            DOMElements.editorView.classList.toggle('active', viewName === 'editor');
        };

        // ===================================================================
        // EDITOR FUNCTIONS (UPLOAD & GENERATE)
        // ===================================================================

        const handleFile = (file) => {
            try { 
                if (!file) {
                    return SafeUI.showModal('Error', '<p>No file selected.</p>', [{label: 'OK'}]);
                }
                if (file.size > MAX_FILE_SIZE_BYTES) { 
                    return SafeUI.showModal('File Too Large', '<p>File must be under 10MB.</p>', [{label: 'OK'}]); 
                }

                if (!file.name.endsWith('.msg') && !file.name.endsWith('.oft')) {
                    return SafeUI.showModal('Invalid File', '<p>Please upload a <strong>.msg</strong> or <strong>.oft</strong> file.</p>', [{label: 'OK'}]);
                }
                
                clearEditorFields();

                //
                // === START OF TIER 2 REPLACEMENT ===
                //
                const reader = new FileReader();
                reader.onload = (e) => {
                    let userMessage = 'Failed to parse MSG file. ';
                    let fileData = null;

                    try {
                        if (!window.MsgReader || typeof window.MsgReader.read !== 'function') {
                            throw new Error('MsgReader library not loaded or invalid.');
                        }
                
                        const arrayBuffer = e.target.result;
                        if (!arrayBuffer || arrayBuffer.byteLength < 512) {
                            throw new Error('File too small or empty. MSG files must be at least 512 bytes.');
                        }
                
                        // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                        console.log('File info:', {
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            bufferSize: arrayBuffer.byteLength
                        });
                
                        //
                        // START HYBRID PARSER LOGIC
                        //
                        try {
                            // ---
                            // ATTEMPT 1: Try the robust Tier 2 parser first
                            // ---
                            // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                            console.log('Parsing MSG file with robust parser (Tier 2)...');
                            fileData = window.MsgReader.read(arrayBuffer);
                            // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                            console.log('Parse successful with robust parser!');
                            console.log('Extracted data:', fileData);

                        } catch (robustError) {
                            // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                            console.warn('Robust parser (Tier 2) failed:', robustError.message);
                            
                            // ---
                            // ATTEMPT 2: Fallback to the simple Tier 1.5 parser
                            // ---
                            // (Note: This fallback logic is no longer present in app-core.js, but
                            // we are leaving the handler here just in case)
                            if (typeof window.SimpleMsgParser === 'undefined') {
                                // This is the expected path now.
                                throw robustError; // Re-throw the original error
                            }

                            // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                            console.log('Trying simple parser (Tier 1.5 fallback)...');
                            const simpleParser = new SimpleMsgParser();
                            const simpleData = simpleParser.parse(arrayBuffer);
                            
                            // Manually map the simple data to the
                            // structure expected by the rest of the code
                            fileData = {
                                subject: simpleData.subject || '',
                                body: simpleData.body || '',
                                bodyHTML: '', // Simple parser doesn't get HTML
                                recipients: []
                            };
                            
                            if (simpleData.to) {
                                simpleData.to.split(/[;,]/).forEach(addr => {
                                    addr = addr.trim();
                                    if(addr) fileData.recipients.push({ recipientType: 1, email: addr, name: addr });
                                });
                            }
                            if (simpleData.cc) {
                                simpleData.cc.split(/[;,]/).forEach(addr => {
                                    addr = addr.trim();
                                    if(addr) fileData.recipients.push({ recipientType: 2, email: addr, name: addr });
                                });
                            }
                            // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                            console.log('Parse successful with simple parser (fallback)!');
                            console.log('Extracted data:', fileData);
                        }
                        //
                        // END HYBRID PARSER LOGIC
                        //

                        if (!fileData) {
                            // This should not happen, but as a safeguard
                            throw new Error('Both parsers failed to return data.');
                        }
                
                        // Populate form fields
                        DOMElements.resultSubject.value = fileData.subject || '';
                        
                        //
                        // START FIX #3: Better Body Processing
                        //
                        
                        // Prefer plain text body over HTML, or HTML over null
                        let bodyText = fileData.body || fileData.bodyHTML || '';
                        
                        // If body is a Uint8Array (binary), try to convert it
                        if (bodyText instanceof Uint8Array) {
                            // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                            console.warn('Body is binary data, attempting conversion...');
                            try {
                                // FIX: Try UTF-8 first. This is more common for modern files.
                                const decoder = new TextDecoder('utf-8', { fatal: false });
                                bodyText = decoder.decode(bodyText);
                            } catch (e) {
                                // Fallback to UTF-16LE
                                try {
                                    const decoder = new TextDecoder('utf-16le', { fatal: false });
                                    bodyText = decoder.decode(bodyText);
                                } catch (e2) {
                                    bodyText = '(Unable to decode message body)';
                                }
                            }
                        }
                        
                        // If no plain text body but HTML exists, strip HTML tags
                        // FIX: check bodyText *after* potential binary conversion
                        if (!bodyText && fileData.bodyHTML) {
                            let htmlBody = fileData.bodyHTML;
                            // Check if HTML body is also binary
                            if (htmlBody instanceof Uint8Array) {
                                // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                                console.warn('HTML Body is binary data, attempting conversion...');
                                try {
                                    htmlBody = new TextDecoder('utf-8', { fatal: false }).decode(htmlBody);
                                } catch (e) {
                                    try {
                                        htmlBody = new TextDecoder('utf-16le', { fatal: false }).decode(htmlBody);
                                    } catch (e2) {
                                        htmlBody = '';
                                    }
                                }
                            }

                            if (typeof htmlBody === 'string') {
                                bodyText = htmlBody
                                    .replace(/<style[^>]*>.*?<\/style>/gi, '')
                                    .replace(/<script[^>]*>.*?<\/script>/gi, '')
                                    .replace(/<[^>]+>/g, '')
                                    .replace(/&nbsp;/g, ' ')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&#39;/g, "'")
                                    .trim();
                            }
                        }
                        
                        // Clean up excessive line breaks (max 2 consecutive)
                        if (typeof bodyText === 'string') {
                            bodyText = bodyText.replace(/(\r\n|\r|\n){3,}/g, '\n\n').trim();
                        }
                        
                        DOMElements.resultBody.value = bodyText;
                        //
                        // END FIX #3
                        //
                
                        //
                        // START FIX #2: Better Recipient Processing
                        //
                        // Process recipients
                        const recipients = fileData.recipients || [];
                        
                        // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                        console.log('Processing recipients:', recipients);
                        
                        // <-- NEW DEBUG PROBE
                        console.log('Processing recipients (types):', recipients.map(r => ({ email: r.email, name: r.name, type: r.recipientType })));
                        
                        const toRecipients = [];
                        const ccRecipients = [];
                        const bccRecipients = [];

                        recipients.forEach(r => {
                            // PRIORITIZE EMAIL ADDRESS
                            const addr = r.email || ''; 
                            if (!addr) {
                                // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                                console.warn('Recipient found with no email, skipping:', r.name);
                                return;
                            }
                            
                            // Clean up address (remove display name wrapper if present)
                            let cleanAddr = addr;
                            const match = addr.match(/<([^>]+)>/);
                            if (match) {
                                cleanAddr = match[1];
                            }
                            
                            cleanAddr = cleanAddr.trim();
                            if (!cleanAddr) return;
                            
                            // Categorize by recipient type
                            // Type 1 = TO, Type 2 = CC, Type 3 = BCC
                            if (r.recipientType === 2) {
                                ccRecipients.push(cleanAddr);
                            } else if (r.recipientType === 3) {
                                bccRecipients.push(cleanAddr);
                            } else {
                                // Default to TO
                                toRecipients.push(cleanAddr);
                            }
                        });

                        DOMElements.resultTo.value = toRecipients.join(', ');
                        DOMElements.resultCc.value = ccRecipients.join(', ');
                        DOMElements.resultBcc.value = bccRecipients.join(', ');

                        // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                        console.log('TO:', toRecipients);
                        console.log('CC:', ccRecipients);
                        console.log('BCC:', bccRecipients);
                        //
                        // END FIX #2
                        //
                
                        // Hide output section initially
                        DOMElements.outputWrapper.classList.add('hidden');
                        
                        // Resize textarea
                        setTimeout(() => resizeResultBody(), 0);
                        
                        SafeUI.showToast('MSG file loaded successfully!');
                
                    } catch (err) {
                        // RE-ADDED CONSOLE LOGS FOR DEBUGGING
                        console.error('MSG parsing error:', err);
                        
                        let userMessage = 'Failed to parse MSG file. ';
                        
                        if (err.message.includes('signature')) {
                            userMessage += 'This file does not appear to be a valid Outlook message file (.msg or .oft).';
                        } else if (err.message.includes('too small')) {
                            userMessage += 'The file is too small or corrupted.';
                        } else {
                            userMessage += err.message;
                        }
                        
                        SafeUI.showModal('File Error', `<p>${userMessage}</p>`, [{label: 'OK'}]);
                    }
                };
                reader.onerror = () => {
                    SafeUI.showModal('File Error', '<p>File reading failed. Could not access file content.</p>', [{label: 'OK'}]);
                };
                reader.readAsArrayBuffer(file);
                //
                // === END OF TIER 2 REPLACEMENT ===
                //
            } catch (e) {
                console.error('File operation failed:', e);
                SafeUI.showToast('File operation failed due to internal error.');
            }
        };

        const generateAndShowMailto = () => {
            const mailtoData = {
                to: DOMElements.resultTo.value.trim(),
                cc: DOMElements.resultCc.value.trim(),
                bcc: DOMElements.resultBcc.value.trim(),
                subject: DOMElements.resultSubject.value.trim(),
                body: DOMElements.resultBody.value 
            };

            const mailto = buildMailto(mailtoData);

            currentMailtoCommand = mailto; 
            DOMElements.resultMailto.value = mailto;
            DOMElements.resultLink.href = mailto;
            DOMElements.outputWrapper.classList.remove('hidden');
            
            const templateNameValue = DOMElements.saveTemplateName.value;
            if (!templateNameValue.trim() && !templateNameValue) {
                 DOMElements.saveTemplateName.value = (mailtoData.subject || 'New Template').replace(/[\r\n\t\/\\]/g, ' ').trim();
            }

            setTimeout(() => resizeResultMailto(), 0);
        };
        
        // ===================================================================
        // LIBRARY ACTION HANDLERS
        // ===================================================================
        
        const handleNewTemplate = () => {
            if (hasUnsavedEditorChanges()) {
                UIPatterns.confirmUnsavedChanges(() => {
                    clearEditorFields(); 
                    resizeResultBody(); 
                    showView('editor');
                });
                return;
            }

            clearEditorFields(); 
            resizeResultBody(); 
            showView('editor');
        };
        
        const handleNewFolder = () => {
            SafeUI.showModal('New Folder', createFolderModalHTML(), [ 
                {label: 'Cancel'},
                {label: 'Create', class: 'button-primary', callback: () => {
                    try { 
                        const nameInput = document.getElementById('folder-name-input');
                        const name = nameInput.value.trim();
                        
                        if (name.includes('/') || name.includes('\\')) {
                             return SafeUI.showValidationError('Invalid Name', 'Folder name cannot contain path separators (/, \\).', 'folder-name-input');
                        }

                        if (!SafeUI.validators.notEmpty(name)) {
                            return SafeUI.showValidationError('Invalid Name', 'Folder name cannot be empty.', 'folder-name-input');
                        }
                        
                        const container = getItemsInCurrentFolder();
                        if (validateUniqueInContainer(container, name, 'folder', 'folder-name-input')) {
                             return;
                        }
                        
                        container.push({
                            id: SafeUI.generateId(),
                            type: 'folder',
                            name: name,
                            children: []
                        });
                        saveState();
                        renderCatalogue();
                    } catch(e) {
                        console.error('Folder creation failed:', e);
                        SafeUI.showToast('Folder creation failed due to internal error.');
                    }
                }}
            ]);
        };
        
        const handleSaveToLibrary = () => {
            if (!currentMailtoCommand) {
                SafeUI.showValidationError('No Command Generated', 'Click "Generate Command" first.', 'btn-generate');
                return;
            }

            const name = DOMElements.saveTemplateName.value.trim();
            if (!SafeUI.validators.notEmpty(name)) {
                return SafeUI.showValidationError('Invalid Name', 'Template name cannot be empty.', 'save-template-name');
            }
            
            const container = getItemsInCurrentFolder();
            if (validateUniqueInContainer(container, name, 'item', 'save-template-name')) {
                return;
            }
            
            container.push({
                id: SafeUI.generateId(),
                type: 'item',
                name: name,
                mailto: currentMailtoCommand
            });
            saveState();
            SafeUI.showToast('Template saved!');
            showView('catalogue');
            renderCatalogue();
        };

        // ===================================================================
        // DATA MANAGEMENT HANDLERS (CSV)
        // ===================================================================
        
        const setupSettingsModal = () => {
            const pageDataHtml = `
                <button id="modal-export-csv-btn" class="button-base">Export Library (CSV)</button>
                <button id="modal-import-csv-btn" class="button-base">Import Library (CSV)</button>
            `;

            const onModalOpen = () => {
                CsvManager.setupExport({
                    exportBtn: document.getElementById('modal-export-csv-btn'),
                    headers: APP_CONFIG.CSV_HEADERS,
                    dataGetter: () => {
                        const csvData = [];
                        function walk(items, currentPath) {
                            for (const item of items) {
                                if (item.type === 'folder') {
                                    walk(item.children, currentPath + item.name + '/');
                                } else if (item.type === 'item') {
                                    const mailtoParts = parseMailto(item.mailto);
                                    const row = { name: item.name, path: currentPath };
                                    MAILTO_FIELDS.forEach(field => { row[field] = mailtoParts[field]; });
                                    csvData.push(row);
                                }
                            }
                        }
                        walk(state.library, '/');
                        if (csvData.length === 0) {
                             SafeUI.showToast("Library is empty, nothing to export.");
                             return []; 
                        }
                        return csvData;
                    },
                    filename: `${APP_CONFIG.NAME}-export.csv`
                });
                
                const validateCsvRow = (row, index) => {
                    if (!row.name || !row.name.trim()) {
                        return { error: `Row ${index + 2}: 'name' column is required.` };
                    }
                    if (!row.path || !CSV_PATH_REGEX.test(row.path.trim())) { 
                        return { error: `Row ${index + 2}: 'path' must be a valid folder path like /folder or /folder/subfolder` };
                    }
                    return { entry: row };
                };
                const confirmCsvImport = (validatedData, importErrors) => {
                    const summaryHtml = `<p>This will <strong>ADD ${validatedData.length} templates</strong> to your library. It will skip duplicates (same name in the same path).</p>
                                         ${importErrors.length > 0 ? `<p><strong>${importErrors.length} rows had errors and will be skipped.</strong></p>` : ''}
                                         <p>Do you want to continue?</p>`;
                    SafeUI.showModal("Confirm CSV Import", summaryHtml, [
                        { label: 'Cancel' },
                        { 
                            label: 'Import', 
                            class: 'button-primary', 
                            callback: () => {
                                let importedCount = 0;
                                let skippedCount = 0;
                                for (const row of validatedData) {
                                    const pathParts = row.path.split('/').filter(p => p.trim().length > 0); 
                                    let currentContainer = state.library;
                                    for (const part of pathParts) {
                                        let folder = currentContainer.find(i => i.type === 'folder' && i.name.toLowerCase() === part.toLowerCase());
                                        if (!folder) {
                                            folder = { id: SafeUI.generateId(), type: 'folder', name: part, children: [] };
                                            currentContainer.push(folder);
                                        }
                                        currentContainer = folder.children;
                                    }
                                    if (DataValidator.hasDuplicate(currentContainer, 'name', row.name)) {
                                        skippedCount++;
                                    } else {
                                        const newMailto = buildMailto(row);
                                        currentContainer.push({ id: SafeUI.generateId(), type: 'item', name: row.name.trim(), mailto: newMailto });
                                        importedCount++;
                                    }
                                }
                                if (importedCount > 0) { saveState(); renderCatalogue(); }
                                SafeUI.showToast(`Import complete. Added ${importedCount}, skipped ${skippedCount}.`);
                                SafeUI.hideModal(); 
                            }
                        }
                    ]);
                    return false; 
                };
                CsvManager.setupImport({
                    importBtn: document.getElementById('modal-import-csv-btn'),
                    headers: APP_CONFIG.CSV_HEADERS,
                    onValidate: validateCsvRow,
                    onConfirm: confirmCsvImport
                });
            };

            const onRestore = (dataToRestore) => {
                state.library = dataToRestore.library || [];
                currentFolderId = 'root';
                saveState();
                renderCatalogue();
            };

            window.SharedSettingsModal.init({
                buttonId: 'btn-settings',
                appName: APP_CONFIG.NAME,
                state: { library: state.library, version: state.version },
                pageSpecificDataHtml: pageDataHtml, 
                onModalOpen: onModalOpen,           
                onRestoreCallback: onRestore,
                itemValidators: {
                    library: []
                }
            });
        };


        // ===================================================================
        // EVENT LISTENERS
        // ===================================================================

        const attachEventListeners = () => {
            setupSettingsModal();

            // Catalogue View
            DOMElements.btnNewTemplate.addEventListener('click', handleNewTemplate);
            DOMElements.btnNewFolder.addEventListener('click', handleNewFolder);
            
            // Editor View
            DOMElements.btnEditorCancel.addEventListener('click', () => {
                if (hasUnsavedEditorChanges()) {
                    UIPatterns.confirmUnsavedChanges(() => {
                        showView('catalogue');
                        renderCatalogue();
                    });
                } else {
                    showView('catalogue');
                    renderCatalogue();
                }
            });

            DOMElements.btnGenerate.addEventListener('click', generateAndShowMailto);
            DOMElements.btnSaveToLibrary.addEventListener('click', handleSaveToLibrary);
            
            DOMElements.copyMailtoBtn.addEventListener('click', async () => {
                if (!currentMailtoCommand) {
                    SafeUI.showToast('No command to copy'); 
                    return;
                }
                const success = await SafeUI.copyToClipboard(currentMailtoCommand);
                SafeUI.showToast(success ? "Command copied to clipboard!" : "Failed to copy.");
            });
            
            // Setup Drag and Drop (Editor) (C26)
            DOMElements.uploadWrapper.addEventListener('dragenter', handleDragEnterOver);
            DOMElements.uploadWrapper.addEventListener('dragover', handleDragEnterOver);
            DOMElements.uploadWrapper.addEventListener('dragleave', handleDragLeave);
            DOMElements.uploadWrapper.addEventListener('drop', handleDrop);
            
            DOMElements.msgUpload.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0]);
            });

            // Event Delegation for Lists
            DOMElements.treeListContainer.addEventListener('click', (e) => {
                const itemEl = e.target.closest('.list-item');
                if (!itemEl) return;
                
                if (e.target.closest('.list-item-name')) {
                    return; 
                }
                
                e.preventDefault(); 

                const id = itemEl.dataset.id;
                // REFACTOR: Use findItemById to search the whole tree, not just current folder
                const item = findItemById(id); 
                if (!item) return;

                if (e.target.closest('.list-item-name-folder') || e.target.closest('.list-item-icon.folder')) {
                    if (item.type === 'folder') {
                        navigateToFolder(item.id); 
                    }
                    return;
                }

                const copyBtn = e.target.closest('.copy-btn');
                if (copyBtn) {
                    handleTreeItemCopy(item, copyBtn);
                    return;
                }
                
                // NEW FEATURE: Handle Move Button
                const moveBtn = e.target.closest('.move-btn');
                if (moveBtn) {
                    handleTreeItemMove(id, item);
                    return;
                }
                
                if (e.target.closest('.delete-btn')) {
                    handleTreeItemDelete(id, item);
                    return; 
                }
            });
            
            DOMElements.breadcrumbContainer.addEventListener('click', (e) => {
                 const link = e.target.closest('.breadcrumb-link');
                 if (link && link.dataset.id) {
                     const targetId = link.dataset.id;
                     if (targetId === 'root' || findItemById(targetId)) { 
                         navigateToFolder(targetId); 
                     } else {
                         console.warn('Folder not found, returning to root');
                         navigateToFolder('root'); 
                     }
                 }
            });
        };

        // Init
        const init = () => {
            if (!state.library || !Array.isArray(state.library)) { 
                console.error('State corrupted, resetting library'); 
                state.library = []; 
                saveState(); 
            }
            
            // Setup icons
            DOMElements.btnNewFolder.innerHTML = SafeUI.SVGIcons.plus + ICONS.folder; 

            // Setup textareas
            DOMHelpers.setupTextareaAutoResize(DOMElements.resultBody);
            DOMHelpers.setupTextareaAutoResize(DOMElements.resultMailto, 150);
            
            attachEventListeners();
            
            // Initial render
            showView('catalogue');
            renderCatalogue();
        };

        init();
    });
    </script>
</body>
</html>

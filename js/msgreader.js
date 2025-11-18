/**
 * js/msgreader.js
 * Version 2.0.3 (ES6 Module - Modernized)
 *
 * A robust parser for Microsoft Outlook .msg, .oft, and .eml files.
 * This module reads an ArrayBuffer input and extracts key fields including
 * subject, body, and recipient lists. It handles both OLE (MSG/OFT)
 * and MIME (EML) formats by auto-detecting the file signature.
 */

'use strict';

/**
 * MAPI (Messaging Application Programming Interface) property type constants.
 * These define the data type of a given property.
 */
const PROP_TYPE_INTEGER32 = 0x0003;
const PROP_TYPE_BOOLEAN = 0x000B;
const PROP_TYPE_STRING = 0x001E;
const PROP_TYPE_STRING8 = 0x001F;
const PROP_TYPE_TIME = 0x0040;
const PROP_TYPE_BINARY = 0x0102;

/**
 * MAPI property ID constants for common message fields.
 */
const PROP_ID_SUBJECT = 0x0037;
const PROP_ID_BODY = 0x1000;
const PROP_ID_HTML_BODY = 0x1013;
const PROP_ID_DISPLAY_TO = 0x0E04;
const PROP_ID_DISPLAY_CC = 0x0E03;
const PROP_ID_DISPLAY_BCC = 0x0E02;

/**
 * MAPI property ID constants for recipient-specific fields.
 */
const PROP_ID_RECIPIENT_TYPE = 0x0C15;
const PROP_ID_RECIPIENT_DISPLAY_NAME = 0x3001;
const PROP_ID_RECIPIENT_EMAIL_ADDRESS = 0x3003;
const PROP_ID_RECIPIENT_SMTP_ADDRESS = 0x39FE;

/**
 * MAPI recipient type constants.
 */
const RECIPIENT_TYPE_TO = 1;
const RECIPIENT_TYPE_CC = 2;
const RECIPIENT_TYPE_BCC = 3;

/**
 * Decodes a string from Quoted-Printable encoding.
 * Used primarily for .eml file body content.
 * @param {string} str The Quoted-Printable encoded string.
 * @returns {string} The decoded string.
 */
function _decodeQuotedPrintable(str) {
    if (!str) return '';
    
    let decoded = str
        .replace(/=(\r\n|\n)/g, '')
        .replace(/=([0-9A-F]{2})/g, function(match, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        });
        
    try {
        let bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
        }
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch (e) {
        return decoded;
    }
}

/**
 * Strips HTML tags from a string to extract plain text.
 * Replaces block-level tags with newlines for readability.
 * @param {string} html The HTML string.
 * @returns {string} The extracted plain text.
 */
function _stripHtml(html) {
    if (!html) return '';
    
    let text = html;
    text = text.replace(/<(br|p|div|tr|li|h1|h2|h3|h4|h5|h6)[^>]*>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    
    // Refactor (Mode F): Removed legacy fallback for non-DOMParser environments.
    let doc = new DOMParser().parseFromString(text, 'text/html');
    text = doc.documentElement.textContent || '';
    
    text = text.replace(/(\r\n|\r|\n){3,}/g, '\n\n');
    
    return text.trim();
}

/**
 * Normalizes text by collapsing multiple (3+) newlines into two.
 * @param {string} text The input text.
 * @returns {string} The normalized text.
 */
function _normalizeText(text) {
    if (!text) return '';
    return text.replace(/(\r\n|\r|\n){3,}/g, '\n\n');
}

/**
 * Converts a DataView object to a string based on the specified encoding.
 * Handles 'utf16le', 'utf-8', and fallback 'ascii'.
 * @param {DataView} view The DataView to read from.
 * @param {string} encoding The encoding type ('utf16le', 'utf-8', 'ascii').
 * @returns {string} The decoded string.
 */
function dataViewToString(view, encoding) {
    let result = '';
    let length = view.byteLength;
    
    if (encoding === 'utf16le') {
        for (let i = 0; i < length; i += 2) {
            if (i + 1 < length) {
                let charCode = view.getUint16(i, true);
                if (charCode === 0) break;
                result += String.fromCharCode(charCode);
            }
        }
    } else if (encoding === 'utf-8') {
        try {
            // Refactor (Mode F): Removed manual UTF-8 decoding fallback.
            // Rely on modern TextDecoder API.
            if (typeof TextDecoder === 'undefined') {
                throw new Error("TextDecoder API is not available.");
            }
            
            let decoded = new TextDecoder('utf-8', { fatal: false }).decode(view);
            const nullIdx = decoded.indexOf('\0');
            if (nullIdx !== -1) {
                return decoded.substring(0, nullIdx);
            }
            return decoded;

        } catch (e) {
            return dataViewToString(view, 'ascii');
        }
    } else {
        // Fallback for unknown or 'ascii' encoding
        for (let i = 0; i < length; i++) {
            let charCode = view.getUint8(i);
            if (charCode === 0) break;
            if (charCode === 9 || charCode === 10 || charCode === 13 || (charCode >= 32 && charCode <= 126)) {
                result += String.fromCharCode(charCode);
            }
        }
    }
    
    return result;
}

/**
 * Converts a Windows FILETIME (64-bit value) to a JavaScript Date object.
 * @param {number} low Low 32 bits of the FILETIME.
 * @param {number} high High 32 bits of the FILETIME.
 * @returns {Date | null} The corresponding Date object, or null on failure.
 */
function filetimeToDate(low, high) {
    // FIX (Mode A/B): Add API and input validation.
    if (typeof BigInt === 'undefined') {
        console.error('MsgReader: BigInt API is not available. Cannot parse FILETIME.');
        return null;
    }
    if (typeof low !== 'number' || typeof high !== 'number') {
        console.error('MsgReader: filetimeToDate received invalid input types.', low, high);
        return null;
    }

    const FILETIME_EPOCH_DIFF = 116444736000000000n;
    const TICKS_PER_MILLISECOND = 10000n;
    
    try {
        let filetime = (BigInt(high) << 32n) | BigInt(low);
        let milliseconds = (filetime - FILETIME_EPOCH_DIFF) / TICKS_PER_MILLISECOND;
        return new Date(Number(milliseconds));
    } catch (e) {
        // FIX (Mode A/B): Log the error instead of failing silently.
        console.error('MsgReader: Failed to convert FILETIME to Date.', e);
        return null;
    }
}

/**
 * Refactor (Mode C): Helper to parse a MAPI property tag from a stream name.
 * e.g., "__substg1.0_0037001F" -> { id: 0x0037, type: 0x001F }
 * @param {string} entryName The name of the directory entry.
 * @returns {{id: number, type: number} | null}
 */
function _parsePropTag(entryName) {
    let propTagStr = "00000000";
    if (entryName.length >= 20) {
        propTagStr = entryName.substring(entryName.length - 8);
    } else {
        let parts = entryName.split('_');
        if (parts.length >= 3) {
            propTagStr = parts[2];
        } else {
            return null; // Not a valid property tag name
        }
    }

    try {
        let propId = parseInt(propTagStr.substring(0, 4), 16);
        let propType = parseInt(propTagStr.substring(4, 8), 16);
        return { id: propId, type: propType };
    } catch (e) {
        return null;
    }
}

/**
 * Refactor (Mode C): Helper to decide if a property should be stored.
 * Prioritizes text-based body properties over binary ones.
 * @param {number} propId The MAPI property ID.
 * @param {number} newPropType The MAPI property type of the new stream.
 * @param {object} existingProp The property object already in rawProperties.
 * @returns {boolean}
 */
function _shouldStoreProperty(propId, newPropType, existingProp) {
    let isBodyProperty = (propId === PROP_ID_BODY || propId === PROP_ID_HTML_BODY);
    if (!isBodyProperty || !existingProp) {
        return true; // Not a body property or no conflict, always store.
    }

    let existingIsText = (existingProp.type === PROP_TYPE_STRING || existingProp.type === PROP_TYPE_STRING8);
    let newIsText = (newPropType === PROP_TYPE_STRING || newPropType === PROP_TYPE_STRING8);
    
    if (existingIsText && !newIsText) {
        // Existing is text, new one is binary. Keep text.
        // console.log('[MsgReader] Skipping binary body (0x' + propId.toString(16) + '), keeping text version');
        return false;
    }
    
    if (!existingIsText && newIsText) {
        // Existing is binary, new one is text. Replace with text.
        // console.log('[MsgReader] Replacing binary body (0x' + propId.toString(16) + ') with text version');
        return true;
    }
    
    // Both are text or both are binary. Default to keeping the first one.
    return false;
}

/**
 * Main parser class for MSG/OFT/EML files.
 * @param {ArrayBuffer | Uint8Array | Array<number>} arrayBuffer The file content.
 * @constructor
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
    this._mimeScanCache = null;
}

/**
 * Parses the buffer as an OLE (MSG/OFT) file.
 * Reads the OLE header, FAT, directory, and extracts properties.
 * @returns {object} The parsed message data.
 */
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
            recipients: this.getFieldValue('recipients')
        };
    } catch (e) {
        console.error('MSG parsing error:', e);
        throw new Error('Failed to parse MSG file: ' + e.message);
    }
};

/**
 * Parses the buffer as a MIME (.eml) file.
 * This is a fallback parser for non-OLE files.
 * @returns {object} The parsed message data.
 */
MsgReader.prototype.parseMime = function() {
    // console.log('[MsgReader] Parsing as MIME/EML...');
    
    try {
        this._mimeScanCache = null;
        
        let rawText = '';
        try {
            rawText = new TextDecoder('utf-8', { fatal: false }).decode(this.dataView);
        } catch (e) {
            rawText = new TextDecoder('latin1').decode(this.dataView);
        }
        
        let mimeData = this._scanBufferForMimeText(rawText);
        
        let recipients = [];
        
        let parseMimeAddresses = function(addrString, type) {
            if (!addrString) return;
            addrString.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).forEach(function(addr) {
                let parsed = parseAddress(addr);
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
        
        let bccMatch = rawText.match(/^Bcc:\s*([^\r\n]+)/im);
        if (bccMatch) {
            parseMimeAddresses(bccMatch[1].trim(), RECIPIENT_TYPE_BCC);
        }

        this.properties[PROP_ID_SUBJECT] = { id: PROP_ID_SUBJECT, value: mimeData.subject };
        this.properties[PROP_ID_BODY] = { id: PROP_ID_BODY, value: mimeData.body };
        this.properties[PROP_ID_HTML_BODY] = { id: PROP_ID_HTML_BODY, value: null };
        this.properties['recipients'] = { id: 0, value: recipients };

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
 * Reads the OLE Compound File Binary (CFB) header.
 * Verifies the OLE signature and extracts key metadata.
 */
MsgReader.prototype.readHeader = function() {
    if (this.buffer.byteLength < 512) {
        throw new Error('File too small to be a valid OLE file');
    }

    // OLE signature: 0xD0CF11E0A1B11AE1
    let sig1 = this.dataView.getUint32(0, true);
    let sig2 = this.dataView.getUint32(4, true);
    
    if (sig1 !== 0xE011CFD0 || sig2 !== 0xE11AB1A1) {
        throw new Error('Invalid OLE file signature.');
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
};

/**
 * Reads the File Allocation Table (FAT) from the OLE file.
 * This table manages the chain of sectors for file streams.
 * Handles DIFAT (Double-Indirect FAT) for large files.
 */
MsgReader.prototype.readFAT = function() {
    let sectorSize = this.header.sectorSize;
    let entriesPerSector = sectorSize / 4;
    this.fat = [];

    // Handle standard FAT sectors
    let fatSectorPositions = [];
    for (let i = 0; i < 109 && i < this.header.fatSectors; i++) {
        let sectorNum = this.dataView.getUint32(76 + i * 4, true);
        if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF) {
            fatSectorPositions.push(sectorNum);
        }
    }
    
    // Handle Double-Indirect FAT (DIFAT) if present
    if (this.header.difTotalSectors > 0) {
        let difSector = this.header.difFirstSector;
        let difSectorsRead = 0;
        
        while(difSector !== 0xFFFFFFFE && difSector !== 0xFFFFFFFF && difSectorsRead < this.header.difTotalSectors) {
            let difOffset = 512 + difSector * sectorSize;
            
            for (let j = 0; j < entriesPerSector - 1; j++) {
                let sectorNum = this.dataView.getUint32(difOffset + j * 4, true);
                if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF) {
                    fatSectorPositions.push(sectorNum);
                }
            }
            
            difSector = this.dataView.getUint32(difOffset + (entriesPerSector - 1) * 4, true);
            difSectorsRead++;
        }
    }

    for (let i = 0; i < fatSectorPositions.length; i++) {
        let sectorOffset = 512 + fatSectorPositions[i] * sectorSize;
        
        for (let j = 0; j < entriesPerSector; j++) {
            let offset = sectorOffset + j * 4;
            if (offset + 4 <= this.buffer.byteLength) {
                this.fat.push(this.dataView.getUint32(offset, true));
            }
        }
    }
};

/**
 * Reads the Mini FAT, which manages sectors for small streams
 * (typically < 4096 bytes) stored in the Mini Stream.
 */
MsgReader.prototype.readMiniFAT = function() {
    if (this.header.miniFatFirstSector === 0xFFFFFFFE || 
        this.header.miniFatFirstSector === 0xFFFFFFFF) {
        this.miniFat = [];
        return;
    }

    this.miniFat = [];
    let sector = this.header.miniFatFirstSector;
    let sectorSize = this.header.sectorSize;
    let entriesPerSector = sectorSize / 4;
    let sectorsRead = 0;

    while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sectorsRead < this.header.miniFatTotalSectors) {
        let sectorOffset = 512 + sector * sectorSize;
        
        for (let i = 0; i < entriesPerSector; i++) {
            let offset = sectorOffset + i * 4;
            if (offset + 4 <= this.buffer.byteLength) {
                this.miniFat.push(this.dataView.getUint32(offset, true));
            }
        }

        if (sector >= this.fat.length) break;
        sector = this.fat[sector];
        sectorsRead++;
    }
};

/**
 * Reads the OLE Directory, which contains entries for all
 * storages (folders) and streams (files) in the OLE container.
 */
MsgReader.prototype.readDirectory = function() {
    let sector = this.header.directoryFirstSector;
    let sectorSize = this.header.sectorSize;
    let entrySize = 128;
    let entriesPerSector = sectorSize / entrySize;
    let sectorsRead = 0;

    while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sectorsRead < 1000) {
        let sectorOffset = 512 + sector * sectorSize;

        for (let i = 0; i < entriesPerSector; i++) {
            let entryOffset = sectorOffset + i * entrySize;
            
            if (entryOffset + entrySize > this.buffer.byteLength) {
                break;
            }

            let entry = this.readDirectoryEntry(entryOffset);
            if (entry && entry.name) {
                this.directoryEntries.push(entry);
            }
        }
        
        if (sector >= this.fat.length) break;
        sector = this.fat[sector];
        sectorsRead++;
    }
    
    this.directoryEntries.forEach((de, idx) => de.id = idx);
};

/**
 * Reads a single 128-byte directory entry at the given offset.
 * @param {number} offset The byte offset of the directory entry.
 * @returns {object | null} A parsed directory entry object or null if invalid.
 */
MsgReader.prototype.readDirectoryEntry = function(offset) {
    let nameLength = this.dataView.getUint16(offset + 64, true);
    if (nameLength === 0 || nameLength > 64) {
        return null;
    }

    let nameView = new DataView(this.buffer, offset, Math.min(nameLength, 64));
    let name = dataViewToString(nameView, 'utf16le');

    let type = this.dataView.getUint8(offset + 66);
    
    // 1 = Storage (folder), 2 = Stream (file), 5 = Root Storage
    if (type !== 1 && type !== 2 && type !== 5) {
        return null;
    }

    let startSector = this.dataView.getUint32(offset + 116, true);
    let size = this.dataView.getUint32(offset + 120, true);
    
    let leftSiblingId = this.dataView.getInt32(offset + 68, true);
    let rightSiblingId = this.dataView.getInt32(offset + 72, true);
    let childId = this.dataView.getInt32(offset + 76, true);

    return {
        name: name,
        type: type, 
        startSector: startSector,
        size: size,
        leftSiblingId: leftSiblingId,
        rightSiblingId: rightSiblingId,
        childId: childId,
        id: -1
    };
};

/**
 * Reads the data stream for a given directory entry.
 * Automatically handles dispatching to Mini FAT or standard FAT
 * based on the stream size.
 * @param {object} entry The directory entry for the stream.
 * @returns {Uint8Array} The raw data of the stream.
 */
MsgReader.prototype.readStream = function(entry) {
    if (!entry || entry.size === 0) {
        return new Uint8Array(0);
    }

    let data = new Uint8Array(entry.size);
    let dataOffset = 0;
    let sectorSize = this.header.sectorSize;
    let miniSectorSize = this.header.miniSectorSize;

    let useMini = entry.size < 4096;

    if (useMini) {
        // Stream is small, read from the Mini Stream
        let rootEntry = this.directoryEntries.find(function(e) { return e.type === 5; });
        if (!rootEntry) {
            return new Uint8Array(0);
        }

        let miniStreamData = this.readStream(rootEntry);
        let sector = entry.startSector;
        let sectorsRead = 0;

        while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && 
               dataOffset < entry.size && sectorsRead < 10000) {
            
            let miniOffset = sector * miniSectorSize;
            let bytesToCopy = Math.min(miniSectorSize, entry.size - dataOffset);

            for (let i = 0; i < bytesToCopy && miniOffset + i < miniStreamData.length; i++) {
                data[dataOffset++] = miniStreamData[miniOffset + i];
            }

            if (sector >= this.miniFat.length) break;
            sector = this.miniFat[sector];
            sectorsRead++;
        }
    } else {
        // Stream is large, read from the standard FAT
        let sector = entry.startSector;
        let sectorsRead = 0;

        while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && 
               dataOffset < entry.size && sectorsRead < 10000) {
            
            let sectorOffset = 512 + sector * sectorSize;
            let bytesToCopy = Math.min(sectorSize, entry.size - dataOffset);

            for (let i = 0; i < bytesToCopy && sectorOffset + i < this.buffer.byteLength; i++) {
                data[dataOffset++] = this.dataView.getUint8(sectorOffset + i);
            }

            if (sector >= this.fat.length) break;
            sector = this.fat[sector];
            sectorsRead++;
        }
    }

    return data.slice(0, dataOffset);
};

/**
 * Scans raw text (presumably MIME) for basic email headers and body.
 * Used as a fallback for .eml files.
 * @param {string} rawText The raw text content of the file.
 * @returns {object} An object with subject, to, cc, and body.
 */
MsgReader.prototype._scanBufferForMimeText = function(rawText) {
    if (this._mimeScanCache) {
        return this._mimeScanCache;
    }
    
    if (!rawText) {
        try {
            rawText = new TextDecoder('utf-8', { fatal: false }).decode(this.dataView);
        } catch (e) {
            try {
                rawText = new TextDecoder('latin1').decode(this.dataView);
            } catch (e2) {
                // FIX (Mode A/B): Throw an error instead of failing silently.
                throw new Error('Failed to decode file buffer as text.');
            }
        }
    }

    let result = {
        subject: null,
        to: null,
        cc: null,
        body: null
    };

    let subjectMatch = rawText.match(/^Subject:\s*([^\r\n]+)/im);
    if (subjectMatch) {
        result.subject = subjectMatch[1].trim();
    }

    let toMatch = rawText.match(/^To:\s*([^\r\n]+)/im);
    if (toMatch) {
        result.to = toMatch[1].trim();
    }

    let ccMatch = rawText.match(/^Cc:\s*([^\r\n]+)/im);
    if (ccMatch) {
        result.cc = ccMatch[1].trim();
    }
    
    let headerEndMatch = rawText.match(/(\r\n\r\n|\n\n)/);
    if (headerEndMatch) {
        let bodyText = rawText.substring(headerEndMatch.index + headerEndMatch[0].length);
        
        let transferEncodingMatch = rawText.match(/^Content-Transfer-Encoding:\s*quoted-printable/im);
        
        let plainBodyMatch = bodyText.match(/Content-Type:\s*text\/plain;[\s\S]*?(?:Content-Transfer-Encoding:\s*([\w-]+)[\s\S]*?)?(\r\n\r\n|\n\n)([\s\S]*?)(--_?|\r\n\r\nContent-Type:)/im);
        
        let bodyToDecode = bodyText;
        let encoding = transferEncodingMatch ? 'quoted-printable' : null;

        if (plainBodyMatch && plainBodyMatch[3]) {
            bodyToDecode = plainBodyMatch[3];
            if (plainBodyMatch[1]) {
                encoding = plainBodyMatch[1].trim().toLowerCase();
            }
        } else {
            bodyToDecode = bodyText.split(/--_?|\r\n\r\nContent-Type:/)[0].trim();
        }

        if (encoding === 'quoted-printable') {
            result.body = _decodeQuotedPrintable(bodyToDecode);
        } else {
            result.body = bodyToDecode;
        }
    }

    this._mimeScanCache = result;
    return result;
};

/**
 * Extracts all MAPI properties from the parsed directory streams.
 * Populates the `this.properties` object.
 */
MsgReader.prototype.extractProperties = function() {
    let self = this;
    let rawProperties = {};

    this.directoryEntries.forEach(function(entry) {
        let isRootProperty = entry.name.indexOf('__substg1.0_') === 0;
        let isRecipientProperty = entry.name.indexOf('__recip_version1.0_') > -1;

        if (isRootProperty && !isRecipientProperty) {
            // Refactor (Mode C): Use helper to parse tag
            let propTag = _parsePropTag(entry.name);
            if (!propTag) return; // Skip if not a valid property

            let propId = propTag.id;
            let propType = propTag.type;

            // Refactor (Mode C): Check if we should store before reading stream
            if (!_shouldStoreProperty(propId, propType, rawProperties[propId])) {
                return; // Skip this property, a better version (e.g., text) already exists
            }

            let streamData = self.readStream(entry);

            rawProperties[propId] = {
                id: propId,
                type: propType,
                data: streamData
            };
        }
    });
    
    let bodyHtmlProp = rawProperties[PROP_ID_HTML_BODY];
    if (bodyHtmlProp) {
        this.properties[PROP_ID_HTML_BODY] = {
            id: bodyHtmlProp.id,
            type: bodyHtmlProp.type,
            value: this.convertPropertyValue(bodyHtmlProp.data, bodyHtmlProp.type, bodyHtmlProp.id)
        };
    }
    
    let bodyProp = rawProperties[PROP_ID_BODY];
    if (bodyProp) {
        this.properties[PROP_ID_BODY] = {
            id: bodyProp.id,
            type: bodyProp.type,
            value: this.convertPropertyValue(bodyProp.data, bodyProp.type, bodyProp.id)
        };
    }
    
    let body = this.properties[PROP_ID_BODY] ? this.properties[PROP_ID_BODY].value : null;
    let bodyHtml = this.properties[PROP_ID_HTML_BODY] ? this.properties[PROP_ID_HTML_BODY].value : null;

    // If plain text body is empty but HTML body exists,
    // use the stripped HTML as the plain text body.
    if ((!body || body.length === 0) && bodyHtml && bodyHtml.length > 0) {
        this.properties[PROP_ID_BODY] = {
            id: PROP_ID_BODY,
            type: bodyHtmlProp.type,
            value: this.convertPropertyValue(bodyHtmlProp.data, bodyHtmlProp.type, PROP_ID_BODY)
        };
    }
    
    for (let propId in rawProperties) {
        if (propId != PROP_ID_BODY && propId != PROP_ID_HTML_BODY) {
            let prop = rawProperties[propId];
            this.properties[prop.id] = {
                id: prop.id,
                type: prop.type,
                value: this.convertPropertyValue(prop.data, prop.type, prop.id)
            };
        }
    }
    
    let mimeData = this._scanBufferForMimeText(null);
    
    // Fallback: If properties are missing, attempt to get them
    // from the MIME scanner (for EML files).
    if (!this.properties[PROP_ID_SUBJECT] || !this.properties[PROP_ID_SUBJECT].value) {
        if (mimeData.subject) {
             this.properties[PROP_ID_SUBJECT] = { id: PROP_ID_SUBJECT, type: PROP_TYPE_STRING, value: mimeData.subject };
        }
    }
    if (!this.properties[PROP_ID_BODY] || !this.properties[PROP_ID_BODY].value) {
        if (mimeData.body) {
            this.properties[PROP_ID_BODY] = { id: PROP_ID_BODY, type: PROP_TYPE_STRING, value: mimeData.body };
        }
    }

    this.extractRecipients();
};

/**
 * Converts raw stream data into a usable JavaScript value based on its MAPI type.
 * @param {Uint8Array} data The raw property data.
 * @param {number} type The MAPI property type constant.
 * @param {number} propId The MAPI property ID.
 * @returns {*} The converted value (string, number, boolean, Date, or Uint8Array).
 */
MsgReader.prototype.convertPropertyValue = function(data, type, propId) {
    if (!data || data.length === 0) {
        return null;
    }

    let view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    
    let isBody = (propId === PROP_ID_BODY);
    let isHtmlBody = (propId === PROP_ID_HTML_BODY);
    let isTextProp = (type === PROP_TYPE_STRING || type === PROP_TYPE_STRING8);

    // Special handling for text-based properties (Body, Subject, etc.)
    if (isBody || isHtmlBody || isTextProp || (type === PROP_TYPE_BINARY && data.length > 0)) {
        
        let textUtf16 = null;
        let textUtf8 = null;
        let chosenText = null;

        try { textUtf16 = dataViewToString(view, 'utf16le'); } catch (e) {}
        try { textUtf8 = dataViewToString(view, 'utf-8'); } catch (e) {}
        
        // Attempt to decode as both UTF-16 and UTF-8 and check
        // which one results in more printable characters.
        let printableRatio = (s) => {
            if (!s || s.length === 0) return 0;
            return s.replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF]/g, '').length / s.length;
        };

        let ratioUtf16 = printableRatio(textUtf16);
        let ratioUtf8 = printableRatio(textUtf8);

        // Prioritize encoding based on MAPI type, but override if
        // the printable character ratio suggests the other encoding.
        if (type === PROP_TYPE_STRING8 && ratioUtf16 > 0.7) {
             chosenText = textUtf16;
        }
        else if (type === PROP_TYPE_STRING && ratioUtf8 > 0.7) {
             chosenText = textUtf8;
        }
        else if (ratioUtf16 > ratioUtf8 && ratioUtf16 > 0.7) {
            chosenText = textUtf16;
        } else if (ratioUtf8 > ratioUtf16 && ratioUtf8 > 0.7) {
            chosenText = textUtf8;
        } else {
            chosenText = (type === PROP_TYPE_STRING8) ? textUtf16 : textUtf8;
        }
        
        if (isBody) {
            // For plain text body, strip HTML (in case it's from HTML body)
            return _normalizeText(_stripHtml(chosenText));
        } else if (isHtmlBody) {
            return chosenText;
        }
        
        if (isTextProp) {
            return chosenText;
        }
        
        if (type === PROP_TYPE_BINARY) {
            return data;
        }
    }

    switch (type) {
        case PROP_TYPE_INTEGER32:
            return view.byteLength >= 4 ? view.getUint32(0, true) : 0;

        case PROP_TYPE_BOOLEAN:
            return view.byteLength > 0 ? view.getUint8(0) !== 0 : false;

        case PROP_TYPE_TIME:
            if (view.byteLength >= 8) {
                let low = view.getUint32(0, true);
                let high = view.getUint32(4, true);
                return filetimeToDate(low, high);
            }
            return null;

        default:
            return data;
    }
};

/**
 * Parses a single recipient string (e.g., "John Doe <john.doe@example.com>")
 * into a name and email object.
 * @param {string} addr The recipient string.
 * @returns {{name: string, email: string | null}}
 */
function parseAddress(addr) {
    if (!addr) return { name: '', email: null };
    addr = addr.trim();
    let email = addr;
    let name = addr;

    let match = addr.match(/^(.*)<([^>]+)>$/);
    if (match) {
        name = match[1].trim().replace(/^"|"$/g, '');
        email = match[2].trim();
    }

    // Use a regex that is more permissive for emails but still extracts the core part.
    // This is not RFC 5322 compliant, but handles common cases found in MSG files.
    let emailMatch = email.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    
    if (emailMatch) {
        email = emailMatch[0];
        if (name === addr) {
            if (name === email) {
                name = '';
            } else {
                name = name.replace(email, '').trim();
            }
        }
    } else {
        email = null;
    }

    return { name: name, email: email };
}

/**
 * Extracts recipient information from the recipient storage entries.
 * Also uses DisplayTo/Cc/Bcc properties to help resolve recipient types.
 */
MsgReader.prototype.extractRecipients = function() {
    let self = this;
    let recipients = [];

    // 1. Iterate over dedicated recipient storage entries
    let recipientStorages = this.directoryEntries.filter(function(entry) {
        return entry.type === 1 && entry.name.indexOf('__recip_version1.0_') === 0;
    });

    recipientStorages.forEach(function(recipStorage) {
        let recipient = {
            recipientType: RECIPIENT_TYPE_TO,
            name: '',
            email: ''
        };

        let stack = [recipStorage.childId];
        let visited = new Set();
        let maxProps = 100;
        let propsFound = 0;

        // 2. Read properties from within each recipient storage
        while (stack.length > 0 && propsFound < maxProps) {
            let entryId = stack.pop();

            if (entryId === -1 || entryId === 0xFFFFFFFF || !entryId || visited.has(entryId)) {
                continue;
            }
            visited.add(entryId);

            let entry = self.directoryEntries[entryId];
            if (!entry) continue;

            // Refactor (Mode C): Flatten logic with guard clause and helper
            if (entry.type !== 2 || entry.name.indexOf('__substg1.0_') === -1) {
                if (entry.leftSiblingId !== -1 && entry.leftSiblingId < self.directoryEntries.length && !visited.has(entry.leftSiblingId)) {
                    stack.push(entry.leftSiblingId);
                }
                if (entry.rightSiblingId !== -1 && entry.rightSiblingId < self.directoryEntries.length && !visited.has(entry.rightSiblingId)) {
                    stack.push(entry.rightSiblingId);
                }
                if (entry.childId !== -1 && entry.childId < self.directoryEntries.length && !visited.has(entry.childId)) {
                    stack.push(entry.childId);
                }
                continue;
            }
            
            propsFound++;
            let propTag = _parsePropTag(entry.name);
            if (!propTag) continue;

            let propId = propTag.id;
            let propType = propTag.type;

            let streamData = self.readStream(entry);
            let value = self.convertPropertyValue(streamData, propType, propId);

            switch(propId) {
                case PROP_ID_RECIPIENT_DISPLAY_NAME:
                    recipient.name = value || recipient.name;
                    break;
                case PROP_ID_RECIPIENT_EMAIL_ADDRESS:
                case PROP_ID_RECIPIENT_SMTP_ADDRESS:
                    recipient.email = value || recipient.email;
                    break;
                case PROP_ID_RECIPIENT_TYPE:
                    if (typeof value === 'number') {
                        recipient.recipientType = value;
                    }
                    break;
            }

            // Traversal logic was moved into the guard clause's "if" block
        }

        if (recipient.name || recipient.email) {
            if (!recipient.email && recipient.name && recipient.name.indexOf('@') > -1) {
                recipient.email = recipient.name;
            }
            if (!recipient.name && recipient.email) {
                recipient.name = recipient.email;
            }
            
            if (recipient.email) {
                recipients.push(recipient);
            }
        }
    });

    // 3. Use DisplayTo/Cc/Bcc fields to refine recipient types,
    // as the RECIPIENT_TYPE prop is not always reliable.
    let displayTo = self.properties[PROP_ID_DISPLAY_TO] ? self.properties[PROP_ID_DISPLAY_TO].value : null;
    let displayCc = self.properties[PROP_ID_DISPLAY_CC] ? self.properties[PROP_ID_DISPLAY_CC].value : null;
    let displayBcc = self.properties[PROP_ID_DISPLAY_BCC] ? self.properties[PROP_ID_DISPLAY_BCC].value : null;

    let displayToEmails = [];
    let displayCcEmails = [];
    let displayBccEmails = [];
    
    if (displayTo) {
        displayTo.split(';').forEach(function(addrStr) {
            let parsed = parseAddress(addrStr);
            if (parsed.email) {
                displayToEmails.push(parsed.email.toLowerCase());
            }
        });
    }
    if (displayCc) {
        displayCc.split(';').forEach(function(addrStr) {
            let parsed = parseAddress(addrStr);
            if (parsed.email) {
                displayCcEmails.push(parsed.email.toLowerCase());
            }
        });
    }
    if (displayBcc) {
        displayBcc.split(';').forEach(function(addrStr) {
            let parsed = parseAddress(addrStr);
            if (parsed.email) {
                displayBccEmails.push(parsed.email.toLowerCase());
            }
        });
    }
    
    // Count occurrences of each email in the display fields
    let toEmailCounts = {};
    let ccEmailCounts = {};
    let bccEmailCounts = {};

    displayToEmails.forEach(function(email) {
        toEmailCounts[email] = (toEmailCounts[email] || 0) + 1;
    });

    displayCcEmails.forEach(function(email) {
        ccEmailCounts[email] = (ccEmailCounts[email] || 0) + 1;
    });
    
    displayBccEmails.forEach(function(email) {
        bccEmailCounts[email] = (bccEmailCounts[email] || 0)_ + 1;
    });
    
    // Assign types based on display field counts
    recipients.forEach(function(recipient) {
        if (!recipient.email) return; 
        
        let emailKey = recipient.email.toLowerCase();
        
        if (ccEmailCounts[emailKey] && ccEmailCounts[emailKey] > 0) {
            recipient.recipientType = RECIPIENT_TYPE_CC;
            ccEmailCounts[emailKey]--;
        }
        else if (toEmailCounts[emailKey] && toEmailCounts[emailKey] > 0) {
            recipient.recipientType = RECIPIENT_TYPE_TO;
            toEmailCounts[emailKey]--;
        }
        else if (bccEmailCounts[emailKey] && bccEmailCounts[emailKey] > 0) {
            recipient.recipientType = RECIPIENT_TYPE_BCC;
            bccEmailCounts[emailKey]--;
        }
    });
    
    this.properties['recipients'] = {
        id: 0,
        type: 0,
        value: recipients
    };
};

/**
 * Public getter for common field values by name.
 * @param {string} fieldName The name of the field ('subject', 'body', 'bodyHTML', 'recipients').
 * @returns {*} The value of the field.
 */
MsgReader.prototype.getFieldValue = function(fieldName) {
    let propId;

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
            return this.properties['recipients'] ? this.properties['recipients'].value : [];
        default:
            return null;
    }

    let prop = this.properties[propId];
    return prop ? prop.value : null;
};

/**
 * Public entry point for the parser.
 * Auto-detects file type (OLE vs. MIME) and calls the correct parser.
 */
const MsgReader = {
    /**
     * Reads an ArrayBuffer and parses its content.
     * @param {ArrayBuffer | Uint8Array | Array<number>} arrayBuffer The file content.
     * @returns {object} The parsed message data.
     */
    read: function(arrayBuffer) {
        let reader = new MsgReader(arrayBuffer);
        
        if (reader.dataView.byteLength < 8) {
            // console.log('[MsgReader] File too small, attempting MIME parse...');
            return reader.parseMime();
        }
        
        // Check for OLE signature
        let sig1 = reader.dataView.getUint32(0, true);
        let sig2 = reader.dataView.getUint32(4, true);

        if (sig1 === 0xE011CFD0 && sig2 === 0xE11AB1A1) {
            // console.log('[MsgReader] OLE signature detected, parsing as MSG/OFT...');
            return reader.parse();
        } else {
            // console.log('[MsgReader] No OLE signature, parsing as MIME/EML...');
            return reader.parseMime();
        }
    }
};

// Export as ES6 module
export { MsgReader };
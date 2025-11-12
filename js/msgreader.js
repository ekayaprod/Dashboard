/**
 * msg-reader.js v1.4.19 (Production Fix)
 * Production-grade Microsoft Outlook MSG/OFT/EML file parser
 *
 * CHANGELOG:
 * v1.4.19 (Production Fix):
 * 1. [FIX] Fixed .oft file body text decoding by implementing TYPE-BASED
 *    priority for duplicate property IDs. Text types (0x1E/0x1F) now take
 *    precedence over binary types (0x102) for body/HTML properties.
 *    This resolves the issue where body text appeared as garbled control
 *    characters ("\x1E�") in .oft files.
 * 2. [FIX] Removed excessive debug logging to clean up console output.
 *
 * v1.4.18 (Gemini Patch):
 * 1. [FIX] Overhauled `_stripHtml` to use robust multi-stage regex.
 * 2. [FIX] Overhauled `_scanBufferForMimeText` regex to be multiline.
 * 3. [FEATURE] Added `_decodeQuotedPrintable` helper for .eml files.
 * 4. [FIX] Updated `parseMime` to use stricter regex for Bcc.
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

    // --- MAPI Property Types ---
    var PROP_TYPE_INTEGER32 = 0x0003;
    var PROP_TYPE_BOOLEAN = 0x000B;
    var PROP_TYPE_STRING = 0x001E;
    var PROP_TYPE_STRING8 = 0x001F;
    var PROP_TYPE_TIME = 0x0040;
    var PROP_TYPE_BINARY = 0x0102;

    // --- MAPI Property IDs ---
    var PROP_ID_SUBJECT = 0x0037;
    var PROP_ID_BODY = 0x1000;
    var PROP_ID_HTML_BODY = 0x1013;
    var PROP_ID_DISPLAY_TO = 0x0E04;
    var PROP_ID_DISPLAY_CC = 0x0E03;
    var PROP_ID_DISPLAY_BCC = 0x0E02;

    // Recipient-specific Property IDs
    var PROP_ID_RECIPIENT_TYPE = 0x0C15;
    var PROP_ID_RECIPIENT_DISPLAY_NAME = 0x3001;
    var PROP_ID_RECIPIENT_EMAIL_ADDRESS = 0x3003;
    var PROP_ID_RECIPIENT_SMTP_ADDRESS = 0x39FE;

    // --- MAPI Recipient Types ---
    var RECIPIENT_TYPE_TO = 1;
    var RECIPIENT_TYPE_CC = 2;
    var RECIPIENT_TYPE_BCC = 3;
    
    function _decodeQuotedPrintable(str) {
        if (!str) return '';
        
        var decoded = str
            .replace(/=(\r\n|\n)/g, '')
            .replace(/=([0-9A-F]{2})/g, function(match, hex) {
                return String.fromCharCode(parseInt(hex, 16));
            });
            
        try {
            var bytes = new Uint8Array(decoded.length);
            for (var i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.charCodeAt(i);
            }
            return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        } catch (e) {
            return decoded;
        }
    }

    function _stripHtml(html) {
        if (!html) return '';
        
        var text = html;
        text = text.replace(/<(br|p|div|tr|li|h1|h2|h3|h4|h5|h6)[^>]*>/gi, '\n');
        text = text.replace(/<[^>]+>/g, '');
        
        var doc;
        if (typeof DOMParser !== 'undefined') {
            doc = new DOMParser().parseFromString(text, 'text/html');
            text = doc.documentElement.textContent || '';
        } else {
            text = text
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
        }
        
        text = text.replace(/(\r\n|\r|\n){3,}/g, '\n\n');
        
        return text.trim();
    }
    
    function _normalizeText(text) {
        if (!text) return '';
        return text.replace(/(\r\n|\r|\n){3,}/g, '\n\n');
    }

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
            try {
                if (typeof TextDecoder !== 'undefined') {
                    var decoded = new TextDecoder('utf-8', { fatal: false }).decode(view);
                    const nullIdx = decoded.indexOf('\0');
                    if (nullIdx !== -1) {
                        return decoded.substring(0, nullIdx);
                    }
                    return decoded;
                }
                
                var bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
                var str = '';
                for (var i = 0; i < bytes.length; i++) {
                    var charCode = bytes[i];
                    if (charCode === 0) break;
                    
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
                return dataViewToString(view, 'ascii');
            }
        } else {
            for (var i = 0; i < length; i++) {
                var charCode = view.getUint8(i);
                if (charCode === 0) break;
                if (charCode === 9 || charCode === 10 || charCode === 13 || (charCode >= 32 && charCode <= 126)) {
                    result += String.fromCharCode(charCode);
                }
            }
        }
        
        return result;
    }

    function filetimeToDate(low, high) {
        var FILETIME_EPOCH_DIFF = 116444736000000000n;
        var TICKS_PER_MILLISECOND = 10000n;
        
        try {
            var filetime = (BigInt(high) << 32n) | BigInt(low);
            var milliseconds = (filetime - FILETIME_EPOCH_DIFF) / TICKS_PER_MILLISECOND;
            return new Date(Number(milliseconds));
        } catch (e) {
            return null;
        }
    }

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
    
    MsgReader.prototype.parseMime = function() {
        console.log('[MsgReader] Parsing as MIME/EML...');
        
        try {
            this._mimeScanCache = null;
            
            var rawText = '';
            try {
                rawText = new TextDecoder('utf-8', { fatal: false }).decode(this.dataView);
            } catch (e) {
                rawText = new TextDecoder('latin1').decode(this.dataView);
            }
            
            var mimeData = this._scanBufferForMimeText(rawText);
            
            var recipients = [];
            
            var parseMimeAddresses = function(addrString, type) {
                if (!addrString) return;
                addrString.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).forEach(function(addr) {
                    var parsed = parseAddress(addr);
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
            
            var bccMatch = rawText.match(/^Bcc:\s*([^\r\n]+)/im);
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

    MsgReader.prototype.readHeader = function() {
        if (this.buffer.byteLength < 512) {
            throw new Error('File too small to be valid MSG/OFT file');
        }

        var sig1 = this.dataView.getUint32(0, true);
        var sig2 = this.dataView.getUint32(4, true);
        
        if (sig1 !== 0xE011CFD0 || sig2 !== 0xE11AB1A1) {
            throw new Error('Invalid file signature. Not a valid OLE file (MSG/OFT).');
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

    MsgReader.prototype.readFAT = function() {
        var sectorSize = this.header.sectorSize;
        var entriesPerSector = sectorSize / 4;
        this.fat = [];

        var fatSectorPositions = [];
        for (var i = 0; i < 109 && i < this.header.fatSectors; i++) {
            var sectorNum = this.dataView.getUint32(76 + i * 4, true);
            if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF) {
                fatSectorPositions.push(sectorNum);
            }
        }
        
        if (this.header.difTotalSectors > 0) {
            var difSector = this.header.difFirstSector;
            var difSectorsRead = 0;
            
            while(difSector !== 0xFFFFFFFE && difSector !== 0xFFFFFFFF && difSectorsRead < this.header.difTotalSectors) {
                var difOffset = 512 + difSector * sectorSize;
                
                for (var j = 0; j < entriesPerSector - 1; j++) {
                    var sectorNum = this.dataView.getUint32(difOffset + j * 4, true);
                    if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF) {
                        fatSectorPositions.push(sectorNum);
                    }
                }
                
                difSector = this.dataView.getUint32(difOffset + (entriesPerSector - 1) * 4, true);
                difSectorsRead++;
            }
        }

        for (var i = 0; i < fatSectorPositions.length; i++) {
            var sectorOffset = 512 + fatSectorPositions[i] * sectorSize;
            
            for (var j = 0; j < entriesPerSector; j++) {
                var offset = sectorOffset + j * 4;
                if (offset + 4 <= this.buffer.byteLength) {
                    this.fat.push(this.dataView.getUint32(offset, true));
                }
            }
        }
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

            if (sector >= this.fat.length) break;
            sector = this.fat[sector];
            sectorsRead++;
        }
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
            
            if (sector >= this.fat.length) break;
            sector = this.fat[sector];
            sectorsRead++;
        }
        
        this.directoryEntries.forEach((de, idx) => de.id = idx);
    };

    MsgReader.prototype.readDirectoryEntry = function(offset) {
        var nameLength = this.dataView.getUint16(offset + 64, true);
        if (nameLength === 0 || nameLength > 64) {
            return null;
        }

        var nameView = new DataView(this.buffer, offset, Math.min(nameLength, 64));
        var name = dataViewToString(nameView, 'utf16le');

        var type = this.dataView.getUint8(offset + 66);
        
        if (type !== 1 && type !== 2 && type !== 5) {
            return null;
        }

        var startSector = this.dataView.getUint32(offset + 116, true);
        var size = this.dataView.getUint32(offset + 120, true);
        
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
            id: -1
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

        var useMini = entry.size < 4096;

        if (useMini) {
            var rootEntry = this.directoryEntries.find(function(e) { return e.type === 5; });
            if (!rootEntry) {
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

                if (sector >= this.miniFat.length) break;
                sector = this.miniFat[sector];
                sectorsRead++;
            }
        } else {
            var sector = entry.startSector;
            var sectorsRead = 0;

            while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && 
                   dataOffset < entry.size && sectorsRead < 10000) {
                
                var sectorOffset = 512 + sector * sectorSize;
                var bytesToCopy = Math.min(sectorSize, entry.size - dataOffset);

                for (var i = 0; i < bytesToCopy && sectorOffset + i < this.buffer.byteLength; i++) {
                    data[dataOffset++] = this.dataView.getUint8(sectorOffset + i);
                }

                if (sector >= this.fat.length) break;
                sector = this.fat[sector];
                sectorsRead++;
            }
        }

        return data.slice(0, dataOffset);
    };

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
                    return { subject: null, to: null, cc: null, body: null };
                }
            }
        }

        var result = {
            subject: null,
            to: null,
            cc: null,
            body: null
        };

        var subjectMatch = rawText.match(/^Subject:\s*([^\r\n]+)/im);
        if (subjectMatch) {
            result.subject = subjectMatch[1].trim();
        }

        var toMatch = rawText.match(/^To:\s*([^\r\n]+)/im);
        if (toMatch) {
            result.to = toMatch[1].trim();
        }

        var ccMatch = rawText.match(/^Cc:\s*([^\r\n]+)/im);
        if (ccMatch) {
            result.cc = ccMatch[1].trim();
        }
        
        var headerEndMatch = rawText.match(/(\r\n\r\n|\n\n)/);
        if (headerEndMatch) {
            var bodyText = rawText.substring(headerEndMatch.index + headerEndMatch[0].length);
            
            var transferEncodingMatch = rawText.match(/^Content-Transfer-Encoding:\s*quoted-printable/im);
            
            var plainBodyMatch = bodyText.match(/Content-Type:\s*text\/plain;[\s\S]*?(?:Content-Transfer-Encoding:\s*([\w-]+)[\s\S]*?)?(\r\n\r\n|\n\n)([\s\S]*?)(--_?|\r\n\r\nContent-Type:)/im);
            
            var bodyToDecode = bodyText;
            var encoding = transferEncodingMatch ? 'quoted-printable' : null;

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

    MsgReader.prototype.extractProperties = function() {
        var self = this;
        var rawProperties = {};
    
        this.directoryEntries.forEach(function(entry) {
            var isRootProperty = entry.name.indexOf('__substg1.0_') === 0;
            var isRecipientProperty = entry.name.indexOf('__recip_version1.0_') > -1;

            if (isRootProperty && !isRecipientProperty) {
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
                
                // --- FIX v1.4.19: Type-based priority for duplicate properties ---
                var isBodyProperty = (propId === PROP_ID_BODY || propId === PROP_ID_HTML_BODY);
                var existingProp = rawProperties[propId];
                var shouldStore = true;

                if (isBodyProperty && existingProp) {
                    var existingIsText = (existingProp.type === PROP_TYPE_STRING || existingProp.type === PROP_TYPE_STRING8);
                    var newIsText = (propType === PROP_TYPE_STRING || propType === PROP_TYPE_STRING8);
                    
                    if (existingIsText && !newIsText) {
                        shouldStore = false;
                        console.log('[MsgReader] Skipping binary body (0x' + propId.toString(16) + '), keeping text version');
                    } else if (!existingIsText && newIsText) {
                        console.log('[MsgReader] Replacing binary body (0x' + propId.toString(16) + ') with text version');
                        shouldStore = true;
                    } else {
                        shouldStore = false;
                    }
                }

                if (shouldStore) {
                    rawProperties[propId] = {
                        id: propId,
                        type: propType,
                        data: streamData
                    };
                }
                // --- END FIX v1.4.19 ---
            }
        });
        
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
        
        var body = this.properties[PROP_ID_BODY] ? this.properties[PROP_ID_BODY].value : null;
        var bodyHtml = this.properties[PROP_ID_HTML_BODY] ? this.properties[PROP_ID_HTML_BODY].value : null;

        if ((!body || body.length === 0) && bodyHtml && bodyHtml.length > 0) {
            this.properties[PROP_ID_BODY] = {
                id: PROP_ID_BODY,
                type: bodyHtmlProp.type,
                value: this.convertPropertyValue(bodyHtmlProp.data, bodyHtmlProp.type, PROP_ID_BODY)
            };
        }
        
        for (var propId in rawProperties) {
            if (propId != PROP_ID_BODY && propId != PROP_ID_HTML_BODY) {
                var prop = rawProperties[propId];
                this.properties[prop.id] = {
                    id: prop.id,
                    type: prop.type,
                    value: this.convertPropertyValue(prop.data, prop.type, prop.id)
                };
            }
        }
        
        var mimeData = this._scanBufferForMimeText(null);
        
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

    MsgReader.prototype.convertPropertyValue = function(data, type, propId) {
        if (!data || data.length === 0) {
            return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        
        var isBody = (propId === PROP_ID_BODY);
        var isHtmlBody = (propId === PROP_ID_HTML_BODY);
        var isTextProp = (type === PROP_TYPE_STRING || type === PROP_TYPE_STRING8);

        if (isBody || isHtmlBody || isTextProp || (type === PROP_TYPE_BINARY && data.length > 0)) {
            
            var textUtf16 = null;
            var textUtf8 = null;
            var chosenText = null;

            try { textUtf16 = dataViewToString(view, 'utf16le'); } catch (e) {}
            try { textUtf8 = dataViewToString(view, 'utf-8'); } catch (e) {}
            
            var printableRatio = (s) => {
                if (!s || s.length === 0) return 0;
                return s.replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF]/g, '').length / s.length;
            };

            var ratioUtf16 = printableRatio(textUtf16);
            var ratioUtf8 = printableRatio(textUtf8);

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
                    var low = view.getUint32(0, true);
                    var high = view.getUint32(4, true);
                    return filetimeToDate(low, high);
                }
                return null;

            default:
                return data;
        }
    };

    function parseAddress(addr) {
        if (!addr) return { name: '', email: null };
        addr = addr.trim();
        var email = addr;
        var name = addr;

        var match = addr.match(/^(.*)<([^>]+)>$/);
        if (match) {
            name = match[1].trim().replace(/^"|"$/g, '');
            email = match[2].trim();
        }

        var emailMatch = email.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
        
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

    MsgReader.prototype.extractRecipients = function() {
        var self = this;
        var recipients = [];
    
        var recipientStorages = this.directoryEntries.filter(function(entry) {
            return entry.type === 1 && entry.name.indexOf('__recip_version1.0_') === 0;
        });
    
        recipientStorages.forEach(function(recipStorage) {
            var recipient = {
                recipientType: RECIPIENT_TYPE_TO,
                name: '',
                email: ''
            };
    
            var stack = [recipStorage.childId];
            var visited = new Set();
            var maxProps = 100;
            var propsFound = 0;

            while (stack.length > 0 && propsFound < maxProps) {
                var entryId = stack.pop();

                if (entryId === -1 || entryId === 0xFFFFFFFF || !entryId || visited.has(entryId)) {
                    continue;
                }
                visited.add(entryId);

                var entry = self.directoryEntries[entryId];
                if (!entry) continue;

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
                }

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
    
        var mimeData = this._scanBufferForMimeText(null);
        
        var displayTo = self.properties[PROP_ID_DISPLAY_TO] ? self.properties[PROP_ID_DISPLAY_TO].value : null;
        var displayCc = self.properties[PROP_ID_DISPLAY_CC] ? self.properties[PROP_ID_DISPLAY_CC].value : null;
        var displayBcc = self.properties[PROP_ID_DISPLAY_BCC] ? self.properties[PROP_ID_DISPLAY_BCC].value : null;

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
        
        var toEmailCounts = {};
        var ccEmailCounts = {};
        var bccEmailCounts = {};

        displayToEmails.forEach(function(email) {
            toEmailCounts[email] = (toEmailCounts[email] || 0) + 1;
        });

        displayCcEmails.forEach(function(email) {
            ccEmailCounts[email] = (ccEmailCounts[email] || 0) + 1;
        });
        
        displayBccEmails.forEach(function(email) {
            bccEmailCounts[email] = (bccEmailCounts[email] || 0) + 1;
        });
        
        recipients.forEach(function(recipient) {
            if (!recipient.email) return; 
            
            var emailKey = recipient.email.toLowerCase();
            
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
                return this.properties['recipients'] ? this.properties['recipients'].value : [];
            default:
                return null;
        }

        var prop = this.properties[propId];
        return prop ? prop.value : null;
    };

    return {
        read: function(arrayBuffer) {
            var reader = new MsgReader(arrayBuffer);
            
            if (reader.dataView.byteLength < 8) {
                console.log('[MsgReader] File too small, attempting MIME parse...');
                return reader.parseMime();
            }
            
            var sig1 = reader.dataView.getUint32(0, true);
            var sig2 = reader.dataView.getUint32(4, true);

            if (sig1 === 0xE011CFD0 && sig2 === 0xE11AB1A1) {
                console.log('[MsgReader] OLE signature detected, parsing as MSG/OFT...');
                return reader.parse();
            } else {
                console.log('[MsgReader] No OLE signature, parsing as MIME/EML...');
                return reader.parseMime();
            }
        }
    };
}));

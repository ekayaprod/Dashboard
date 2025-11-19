/**
 * js/msgreader.js
 * Version 2.0.11 (ES6 Module - Fixes: C.1, C.2, C.3, C.4 - Structural Optimization)
 */

'use strict';

// --- MAPI Constants ---
const PROP_TYPE_INTEGER32 = 0x0003;
const PROP_TYPE_BOOLEAN = 0x000B;
const PROP_TYPE_STRING = 0x001E;
const PROP_TYPE_STRING8 = 0x001F;
const PROP_TYPE_TIME = 0x0040;
const PROP_TYPE_BINARY = 0x0102;

const PROP_ID_SUBJECT = 0x0037;
const PROP_ID_BODY = 0x1000;
const PROP_ID_HTML_BODY = 0x1013;
const PROP_ID_DISPLAY_TO = 0x0E04;
const PROP_ID_DISPLAY_CC = 0x0E03;
const PROP_ID_DISPLAY_BCC = 0x0E02;

const PROP_ID_RECIPIENT_TYPE = 0x0C15;
const PROP_ID_RECIPIENT_DISPLAY_NAME = 0x3001;
const PROP_ID_RECIPIENT_EMAIL_ADDRESS = 0x3003;
const PROP_ID_RECIPIENT_SMTP_ADDRESS = 0x39FE;

const RECIPIENT_TYPE_TO = 1;
const RECIPIENT_TYPE_CC = 2;
const RECIPIENT_TYPE_BCC = 3;

// --- Module-Level Caches (Fix C.3, C.4) ---
let _textDecoderUtf8 = null;
let _textDecoderUtf16 = null;
let _textDecoderWin1252 = null;
let _domParser = null;

function getTextDecoder(encoding) {
    if (encoding === 'utf-8') {
        if (!_textDecoderUtf8) _textDecoderUtf8 = new TextDecoder('utf-8', { fatal: false });
        return _textDecoderUtf8;
    }
    if (encoding === 'utf-16le') {
        if (!_textDecoderUtf16) _textDecoderUtf16 = new TextDecoder('utf-16le', { fatal: false });
        return _textDecoderUtf16;
    }
    if (encoding === 'windows-1252') {
        if (!_textDecoderWin1252) _textDecoderWin1252 = new TextDecoder('windows-1252', { fatal: false });
        return _textDecoderWin1252;
    }
    return new TextDecoder(encoding);
}

function getDOMParser() {
    if (!_domParser && typeof DOMParser !== 'undefined') {
        _domParser = new DOMParser();
    }
    return _domParser;
}

// --- Helpers ---

function _decodeQuotedPrintable(str) {
    if (!str) return '';
    let decoded = str
        .replace(/=(\r\n|\n)/g, '')
        .replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    try {
        let bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
        return getTextDecoder('utf-8').decode(bytes);
    } catch (e) { return decoded; }
}

function _stripHtml(html) {
    if (!html) return '';
    let text = html.replace(/<(br|p|div|tr|li|h1|h2|h3|h4|h5|h6)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '');
    let parser = getDOMParser();
    if (parser) {
        let doc = parser.parseFromString(text, 'text/html');
        text = doc.documentElement.textContent || '';
    }
    return text.replace(/(\r\n|\r|\n){3,}/g, '\n\n').trim();
}

function _normalizeText(text) {
    if (!text) return '';
    return text.replace(/(\r\n|\r|\n){3,}/g, '\n\n');
}

function dataViewToString(view, encoding) {
    // 1. Handle UTF-8
    if (encoding === 'utf-8') {
        try {
            if (typeof TextDecoder === 'undefined') throw new Error("TextDecoder missing");
            let decoded = getTextDecoder('utf-8').decode(view);
            const nullIdx = decoded.indexOf('\0');
            return nullIdx !== -1 ? decoded.substring(0, nullIdx) : decoded;
        } catch (e) { return dataViewToString(view, 'ascii'); }
    }
    
    // 2. Handle UTF-16LE
    if (encoding === 'utf16le') {
        // Primary: TextDecoder
        try {
            if (typeof TextDecoder === 'undefined') throw new Error("TextDecoder missing");
            let decoded = getTextDecoder('utf-16le').decode(view);
            const nullIdx = decoded.indexOf('\0');
            return nullIdx !== -1 ? decoded.substring(0, nullIdx) : decoded;
        } catch (e) {
            // Fallback: Manual Loop (Safe Version)
            let result = '';
            // FIX A.8: Bounds check (view.byteLength - 1) prevents RangeError on odd-length buffers
            for (let i = 0; i < view.byteLength - 1; i += 2) {
                let charCode = view.getUint16(i, true);
                if (charCode === 0) break;
                result += String.fromCharCode(charCode);
            }
            return result;
        }
    }
    
    // 3. ASCII / Legacy Fallback (FIX B.8 - No silent data loss)
    try {
        // Prefer proper 8-bit decoding (Windows-1252 covers ASCII + Western Euro)
        let decoded = getTextDecoder('windows-1252').decode(view);
        const nullIdx = decoded.indexOf('\0');
        return nullIdx !== -1 ? decoded.substring(0, nullIdx) : decoded;
    } catch(e) {
        // Ultimate fallback
        let result = '';
        for (let i = 0; i < view.byteLength; i++) {
            let charCode = view.getUint8(i);
            if (charCode === 0) break;
            result += String.fromCharCode(charCode);
        }
        return result;
    }
}

function filetimeToDate(low, high) {
    if (typeof BigInt === 'undefined') return null;
    try {
        const FILETIME_EPOCH_DIFF = 116444736000000000n;
        let filetime = (BigInt(high) << 32n) | BigInt(low);
        return new Date(Number((filetime - FILETIME_EPOCH_DIFF) / 10000n));
    } catch (e) { return null; }
}

function _parsePropTag(entryName) {
    let propTagStr = "00000000";
    if (entryName.length >= 20) propTagStr = entryName.substring(entryName.length - 8);
    else {
        let parts = entryName.split('_');
        if (parts.length >= 3) propTagStr = parts[2];
        else return null;
    }
    try {
        return { id: parseInt(propTagStr.substring(0, 4), 16), type: parseInt(propTagStr.substring(4, 8), 16) };
    } catch (e) { return null; }
}

function _shouldStoreProperty(propId, newPropType, existingProp) {
    let isBodyProperty = (propId === PROP_ID_BODY || propId === PROP_ID_HTML_BODY);
    if (!isBodyProperty || !existingProp) return true;
    let existingIsText = (existingProp.type === PROP_TYPE_STRING || existingProp.type === PROP_TYPE_STRING8);
    let newIsText = (newPropType === PROP_TYPE_STRING || newPropType === PROP_TYPE_STRING8);
    if (existingIsText && !newIsText) return false;
    if (!existingIsText && newIsText) return true;
    return false;
}

function parseAddress(addr) {
    if (!addr) return { name: '', email: null };
    addr = addr.trim();
    let email = addr, name = addr;
    let match = addr.match(/^(.*)<([^>]+)>$/);
    if (match) { name = match[1].trim().replace(/^"|"$/g, ''); email = match[2].trim(); }
    let emailMatch = email.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    if (emailMatch) {
        email = emailMatch[0];
        if (name === addr) name = (name === email) ? '' : name.replace(email, '').trim();
    } else email = null;
    return { name, email };
}

// --- Internal Parser Class ---
function MsgReaderParser(arrayBuffer) {
    // FIX B.7: Strict Type Guard for Constructor
    if (!(arrayBuffer instanceof ArrayBuffer) && !(arrayBuffer instanceof Uint8Array)) {
        throw new Error("MsgReader: Input must be ArrayBuffer or Uint8Array.");
    }
    this.buffer = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : new Uint8Array(arrayBuffer).buffer;
    this.dataView = new DataView(this.buffer);
    this.header = null; this.fat = null; this.miniFat = null;
    this.directoryEntries = []; this.properties = {}; this._mimeScanCache = null;
}

MsgReaderParser.prototype.parse = function() {
    this.readHeader(); this.readFAT(); this.readMiniFAT(); this.readDirectory(); this.extractProperties();
    return {
        getFieldValue: this.getFieldValue.bind(this),
        subject: this.getFieldValue('subject'),
        body: this.getFieldValue('body'),
        bodyHTML: this.getFieldValue('bodyHTML'),
        recipients: this.getFieldValue('recipients')
    };
};

MsgReaderParser.prototype.parseMime = function() {
    console.log('Parsing as MIME/text file');
    this._mimeScanCache = null;
    let rawText = '';
    try { rawText = getTextDecoder('utf-8').decode(this.dataView); }
    catch (e) { 
        try { rawText = getTextDecoder('latin1').decode(this.dataView); }
        catch (e2) { rawText = ''; }
    }
    
    let mimeData = this._scanBufferForMimeText(rawText);
    let recipients = [];
    let parseMimeAddresses = (addrString, type) => {
        if (!addrString) return;
        addrString.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).forEach(addr => {
            let parsed = parseAddress(addr);
            if (parsed.email) recipients.push({ name: parsed.name, email: parsed.email, recipientType: type });
        });
    };

    parseMimeAddresses(mimeData.to, RECIPIENT_TYPE_TO);
    parseMimeAddresses(mimeData.cc, RECIPIENT_TYPE_CC);
    let bccMatch = rawText.match(/^Bcc:\s*([^\r\n]+)/im);
    if (bccMatch) parseMimeAddresses(bccMatch[1].trim(), RECIPIENT_TYPE_BCC);

    this.properties[PROP_ID_SUBJECT] = { id: PROP_ID_SUBJECT, value: mimeData.subject };
    this.properties[PROP_ID_BODY] = { id: PROP_ID_BODY, value: mimeData.body };
    this.properties[PROP_ID_HTML_BODY] = { id: PROP_ID_HTML_BODY, value: null };
    this.properties['recipients'] = { id: 0, value: recipients };

    return {
        getFieldValue: this.getFieldValue.bind(this),
        subject: mimeData.subject,
        body: mimeData.body,
        bodyHTML: null, recipients: recipients
    };
};

MsgReaderParser.prototype.readHeader = function() {
    if (this.buffer.byteLength < 512) throw new Error('File too small to be a valid OLE file');
    if (this.dataView.getUint32(0, true) !== 0xE011CFD0) throw new Error('Invalid OLE file signature.');
    this.header = {
        sectorShift: this.dataView.getUint16(30, true),
        miniSectorShift: this.dataView.getUint16(32, true),
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

MsgReaderParser.prototype.readFAT = function() {
    let sectorSize = this.header.sectorSize, entriesPerSector = sectorSize / 4;
    this.fat = [];
    let fatSectorPositions = [];
    for (let i = 0; i < 109 && i < this.header.fatSectors; i++) {
        let s = this.dataView.getUint32(76 + i * 4, true);
        if (s !== 0xFFFFFFFE && s !== 0xFFFFFFFF) fatSectorPositions.push(s);
    }
    if (this.header.difTotalSectors > 0) {
        let difSector = this.header.difFirstSector;
        let sectorsRead = 0;
        while (difSector !== 0xFFFFFFFE && difSector !== 0xFFFFFFFF && sectorsRead < this.header.difTotalSectors) {
            let difOffset = 512 + difSector * sectorSize;
            for (let j = 0; j < entriesPerSector - 1; j++) {
                let s = this.dataView.getUint32(difOffset + j * 4, true);
                if (s !== 0xFFFFFFFE && s !== 0xFFFFFFFF) fatSectorPositions.push(s);
            }
            difSector = this.dataView.getUint32(difOffset + (entriesPerSector - 1) * 4, true);
            sectorsRead++;
        }
    }
    for (let i = 0; i < fatSectorPositions.length; i++) {
        let offset = 512 + fatSectorPositions[i] * sectorSize;
        for (let j = 0; j < entriesPerSector; j++) {
            if (offset + j * 4 + 4 <= this.buffer.byteLength) this.fat.push(this.dataView.getUint32(offset + j * 4, true));
        }
    }
};

MsgReaderParser.prototype.readMiniFAT = function() {
    if (this.header.miniFatFirstSector === 0xFFFFFFFE) { this.miniFat = []; return; }
    this.miniFat = [];
    let sector = this.header.miniFatFirstSector, sectorSize = this.header.sectorSize;
    let sectorsRead = 0;
    while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sectorsRead < this.header.miniFatTotalSectors) {
        let offset = 512 + sector * sectorSize;
        for (let i = 0; i < sectorSize / 4; i++) {
            if (offset + i * 4 + 4 <= this.buffer.byteLength) this.miniFat.push(this.dataView.getUint32(offset + i * 4, true));
        }
        if (sector >= this.fat.length) break;
        sector = this.fat[sector];
        sectorsRead++;
    }
};

MsgReaderParser.prototype.readDirectory = function() {
    let sector = this.header.directoryFirstSector, sectorSize = this.header.sectorSize, entrySize = 128;
    let sectorsRead = 0;
    // FIX B.4: Removed arbitrary '1000' limit
    while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF) {
        let offset = 512 + sector * sectorSize;
        for (let i = 0; i < sectorSize / entrySize; i++) {
            let entryOffset = offset + i * entrySize;
            if (entryOffset + entrySize > this.buffer.byteLength) break;
            let entry = this.readDirectoryEntry(entryOffset);
            if (entry && entry.name) this.directoryEntries.push(entry);
        }
        if (sector >= this.fat.length) break;
        sector = this.fat[sector];
        sectorsRead++;
    }
    this.directoryEntries.forEach((de, idx) => de.id = idx);
};

MsgReaderParser.prototype.readDirectoryEntry = function(offset) {
    let nameLen = this.dataView.getUint16(offset + 64, true);
    if (nameLen === 0 || nameLen > 64) return null;
    let name = dataViewToString(new DataView(this.buffer, offset, Math.min(nameLen, 64)), 'utf16le');
    let type = this.dataView.getUint8(offset + 66);
    if (type !== 1 && type !== 2 && type !== 5) return null;
    return {
        name: name, type: type,
        startSector: this.dataView.getUint32(offset + 116, true),
        size: this.dataView.getUint32(offset + 120, true),
        leftSiblingId: this.dataView.getInt32(offset + 68, true),
        rightSiblingId: this.dataView.getInt32(offset + 72, true),
        childId: this.dataView.getInt32(offset + 76, true),
        id: -1
    };
};

// Fix C.1: Parameterized Sector Chain Reader
MsgReaderParser.prototype._readSectorChain = function(startSector, sectorSize, fatArray, totalSize) {
    let data = new Uint8Array(totalSize);
    let dataOffset = 0;
    let sector = startSector;
    
    while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && dataOffset < totalSize) {
        let offset = (fatArray === this.miniFat) 
            ? sector * sectorSize 
            : 512 + sector * sectorSize;
            
        let sourceData = (fatArray === this.miniFat)
            ? this._miniStreamData
            : this.dataView; // Will be handled by byte access loop below
            
        let copy = Math.min(sectorSize, totalSize - dataOffset);
        
        // Optimize read based on source
        for (let i = 0; i < copy; i++) {
            data[dataOffset++] = (fatArray === this.miniFat) 
                ? sourceData[offset + i] 
                : sourceData.getUint8(offset + i);
        }
        
        if (sector >= fatArray.length) break;
        sector = fatArray[sector];
    }
    return data;
};

MsgReaderParser.prototype.readStream = function(entry) {
    if (!entry || entry.size === 0) return new Uint8Array(0);
    
    // Fix C.1: Use the new helper
    if (entry.size < 4096) {
        let root = this.directoryEntries.find(e => e.type === 5);
        if (!root) return new Uint8Array(0);
        
        // Cache mini stream data if needed (optimization)
        if (!this._miniStreamData) {
             this._miniStreamData = this.readStream(root);
        }
        
        return this._readSectorChain(entry.startSector, this.header.miniSectorSize, this.miniFat, entry.size);
    } else {
        this._miniStreamData = null; // Reset if switching contexts
        return this._readSectorChain(entry.startSector, this.header.sectorSize, this.fat, entry.size);
    }
};

MsgReaderParser.prototype._scanBufferForMimeText = function(rawText) {
    if (this._mimeScanCache) return this._mimeScanCache;
    
    if (!rawText) {
        try { rawText = getTextDecoder('utf-8').decode(this.dataView); }
        catch (e) { 
            try { rawText = getTextDecoder('latin1').decode(this.dataView); }
            catch (e2) { 
                console.warn('Could not decode raw buffer for MIME scan.');
                return { subject: null, to: null, cc: null, body: null };
            }
        }
    }

    let result = { subject: null, to: null, cc: null, body: null };
    
    // FIX B.5: Replaced Regex ReDoS Hazard with String methods
    const findField = (name) => {
        const search = new RegExp(`\\b${name}:\\s*([^\\r\\n]+)`, 'i');
        const match = rawText.match(search);
        return match ? match[1].trim() : null;
    };
    
    result.subject = findField('Subject');
    result.to = findField('To');
    result.cc = findField('Cc');
    
    let headerEndIndex = rawText.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) headerEndIndex = rawText.indexOf('\n\n');
    
    if (headerEndIndex !== -1) {
        // Extract body using substring (safer than greedy regex)
        let bodyText = rawText.substring(headerEndIndex + 4); // Skip \r\n\r\n
        
        // Simple logic to find boundaries if multipart
        if (rawText.indexOf('Content-Type: multipart') !== -1) {
             // Try to find plain text part manually without complex regex
             const plainTypeIndex = bodyText.indexOf('Content-Type: text/plain');
             if (plainTypeIndex !== -1) {
                 const start = bodyText.indexOf('\n\n', plainTypeIndex);
                 if (start !== -1) {
                     let end = bodyText.indexOf('--', start);
                     if (end === -1) end = bodyText.length;
                     bodyText = bodyText.substring(start + 2, end).trim();
                 }
             }
        }

        let encoding = null;
        if (rawText.match(/^Content-Transfer-Encoding:\s*quoted-printable/im)) {
            encoding = 'quoted-printable';
        }
        
        result.body = (encoding === 'quoted-printable') ? _decodeQuotedPrintable(bodyText) : bodyText;
    }
    
    this._mimeScanCache = result;
    return result;
};

MsgReaderParser.prototype.extractProperties = function() {
    let self = this, rawProps = {};
    this.directoryEntries.forEach(entry => {
        if (entry.name.indexOf('__substg1.0_') !== 0 || entry.name.indexOf('__recip_version1.0_') > -1) return;
        let propTag = _parsePropTag(entry.name);
        if (!propTag) return;
        if (!_shouldStoreProperty(propTag.id, propTag.type, rawProps[propTag.id])) return;
        rawProps[propTag.id] = { id: propTag.id, type: propTag.type, data: self.readStream(entry) };
    });

    let getVal = (id, type) => {
        let p = rawProps[id];
        return p ? self.convertPropertyValue(p.data, p.type, id) : null;
    };

    let bodyHtml = getVal(PROP_ID_HTML_BODY, PROP_TYPE_STRING);
    if (bodyHtml) this.properties[PROP_ID_HTML_BODY] = { id: PROP_ID_HTML_BODY, value: bodyHtml };
    
    let body = getVal(PROP_ID_BODY, PROP_TYPE_STRING);
    if (!body && bodyHtml) body = _stripHtml(bodyHtml);
    if (body) this.properties[PROP_ID_BODY] = { id: PROP_ID_BODY, value: body };

    Object.values(rawProps).forEach(p => {
        if (p.id !== PROP_ID_BODY && p.id !== PROP_ID_HTML_BODY) {
            this.properties[p.id] = { id: p.id, value: self.convertPropertyValue(p.data, p.type, p.id) };
        }
    });

    let mimeData = this._scanBufferForMimeText(null);
    if (!this.properties[PROP_ID_SUBJECT]) this.properties[PROP_ID_SUBJECT] = { value: mimeData.subject };
    if (!this.properties[PROP_ID_BODY]) this.properties[PROP_ID_BODY] = { value: mimeData.body };

    this.extractRecipients();
};

MsgReaderParser.prototype.convertPropertyValue = function(data, type, propId) {
    if (!data || data.length === 0) return null;
    let view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    
    if (propId === PROP_ID_BODY || propId === PROP_ID_HTML_BODY || type === PROP_TYPE_STRING || type === PROP_TYPE_STRING8 || type === PROP_TYPE_BINARY) {
        let u16 = '', u8 = '';
        try { u16 = dataViewToString(view, 'utf16le'); } catch (e) {}
        try { u8 = dataViewToString(view, 'utf-8'); } catch (e) {}
        
        let isPrintable = (s) => {
            if (!s || s.length === 0) return false;
            let printableCount = s.replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF]/g, '').length;
            return (printableCount / s.length) > 0.7;
        };
        
        // HEURISTIC FIX V2.0.8: Detect Truncated UTF-8
        let u16IsBetter = isPrintable(u16);
        let u8IsBetter = isPrintable(u8);
        
        if (u8IsBetter && u16IsBetter && u8.length < u16.length && u8.length < 5) {
             u8IsBetter = false;
        }
        
        let useU16 = false;
        if (type === PROP_TYPE_STRING8) {
            useU16 = u16IsBetter && !u8IsBetter;
        } else {
            useU16 = u16IsBetter;
        }
        
        let text = useU16 ? u16 : u8;

        if (propId === PROP_ID_BODY) return _normalizeText(_stripHtml(text));
        if (type === PROP_TYPE_BINARY) return data;
        return text;
    }
    if (type === PROP_TYPE_INTEGER32) return view.byteLength >= 4 ? view.getUint32(0, true) : 0;
    if (type === PROP_TYPE_BOOLEAN) return view.byteLength > 0 ? view.getUint8(0) !== 0 : false;
    if (type === PROP_TYPE_TIME) return view.byteLength >= 8 ? filetimeToDate(view.getUint32(0, true), view.getUint32(4, true)) : null;
    return data;
};

// Fix C.2: Helper for address extraction
function _extractAddresses(displayString) {
    let emails = [];
    if (displayString) {
        displayString.split(/[;,]/).forEach(addr => {
            let parsed = parseAddress(addr);
            if (parsed.email) emails.push(parsed.email.toLowerCase());
        });
    }
    return emails;
}

MsgReaderParser.prototype.extractRecipients = function() {
    let self = this;
    let recipients = [];
    
    let recipientStorages = this.directoryEntries.filter(entry => 
        entry.type === 1 && entry.name.indexOf('__recip_version1.0_') === 0
    );
    
    recipientStorages.forEach(storage => {
        let recipient = {
            recipientType: RECIPIENT_TYPE_TO,
            name: '',
            email: ''
        };
        
        let findChildren = (parentId) => {
            let parent = self.directoryEntries[parentId];
            if (!parent || parent.childId === -1) return [];
            let children = [];
            let stack = [parent.childId];
            let visited = new Set();
            
            while (stack.length > 0) {
                let id = stack.pop();
                if (id === -1 || visited.has(id)) continue;
                visited.add(id);
                let entry = self.directoryEntries[id];
                if (!entry) continue;
                children.push(entry);
                if (entry.leftSiblingId !== -1) stack.push(entry.leftSiblingId);
                if (entry.rightSiblingId !== -1) stack.push(entry.rightSiblingId);
            }
            return children;
        };
        
        let children = findChildren(storage.id);
        children.forEach(child => {
            let propTag = _parsePropTag(child.name);
            if (!propTag) return;
            
            let propData = self.readStream(child);
            let propValue = self.convertPropertyValue(propData, propTag.type, propTag.id);
            
            if (propTag.id === PROP_ID_RECIPIENT_TYPE) {
                recipient.recipientType = propValue || RECIPIENT_TYPE_TO;
            } else if (propTag.id === PROP_ID_RECIPIENT_DISPLAY_NAME) {
                recipient.name = propValue || '';
            } else if (propTag.id === PROP_ID_RECIPIENT_EMAIL_ADDRESS || propTag.id === PROP_ID_RECIPIENT_SMTP_ADDRESS) {
                if (propValue && propValue.indexOf('@') > -1) {
                    recipient.email = propValue;
                }
            }
        });
        
        if (recipient.email || recipient.name) {
            recipients.push(recipient);
        }
    });
    
    console.log('METHOD 1: Extracted recipients from OLE storages:', recipients.length);
    recipients.forEach((r, i) => console.log(`  [${i}] Type=${r.recipientType}, Email=${r.email}, Name=${r.name}`));
    
    let displayTo = this.properties[PROP_ID_DISPLAY_TO] ? this.properties[PROP_ID_DISPLAY_TO].value : null;
    let displayCc = this.properties[PROP_ID_DISPLAY_CC] ? this.properties[PROP_ID_DISPLAY_CC].value : null;
    
    console.log('METHOD 3: Display Fields');
    console.log('  DisplayTo:', displayTo);
    console.log('  DisplayCc:', displayCc);
    
    if (displayTo || displayCc) {
        // FIX C.2: Use helper
        let displayToEmails = _extractAddresses(displayTo);
        let displayCcEmails = _extractAddresses(displayCc);
        
        console.log('  Parsed TO emails:', displayToEmails);
        console.log('  Parsed CC emails:', displayCcEmails);
        
        let toEmailCounts = {};
        let ccEmailCounts = {};
        
        displayToEmails.forEach(email => {
            toEmailCounts[email] = (toEmailCounts[email] || 0) + 1;
        });
        
        displayCcEmails.forEach(email => {
            ccEmailCounts[email] = (ccEmailCounts[email] || 0) + 1;
        });
        
        console.log('  TO counts:', toEmailCounts);
        console.log('  CC counts:', ccEmailCounts);
        
        recipients.forEach(recipient => {
            let emailKey = recipient.email.toLowerCase();
            
            if (ccEmailCounts[emailKey] && ccEmailCounts[emailKey] > 0) {
                recipient.recipientType = RECIPIENT_TYPE_CC;
                ccEmailCounts[emailKey]--;
                console.log(`  Matched ${emailKey} to CC (remaining: ${ccEmailCounts[emailKey]})`);
            }
            else if (toEmailCounts[emailKey] && toEmailCounts[emailKey] > 0) {
                recipient.recipientType = RECIPIENT_TYPE_TO;
                toEmailCounts[emailKey]--;
                console.log(`  Matched ${emailKey} to TO (remaining: ${toEmailCounts[emailKey]})`);
            }
        });
    }
    
    console.log('FINAL: Corrected recipient types');
    recipients.forEach((r, i) => console.log(`  [${i}] Type=${r.recipientType}, Email=${r.email}`));
    
    this.properties['recipients'] = { id: 0, value: recipients };
};

MsgReaderParser.prototype.getFieldValue = function(name) {
    let id = { subject: PROP_ID_SUBJECT, body: PROP_ID_BODY, bodyHTML: PROP_ID_HTML_BODY }[name];
    if (name === 'recipients') return this.properties['recipients'] ? this.properties['recipients'].value : [];
    return (this.properties[id]) ? this.properties[id].value : null;
};

// --- Exported Object ---
const MsgReader = {
    read: function(arrayBuffer) {
        let reader = new MsgReaderParser(arrayBuffer);
        if (reader.dataView.byteLength < 8) return reader.parseMime();
        let sig = reader.dataView.getUint32(0, true);
        return (sig === 0xE011CFD0) ? reader.parse() : reader.parseMime();
    }
};

export { MsgReader };
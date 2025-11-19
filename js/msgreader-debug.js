/**
 * js/msgreader-debug.js
 * Version 3.0 (QA Instrumented - With Full Property Inventory)
 */

'use strict';

class LogBuffer {
    constructor() { this.lines = []; }
    add(str) { this.lines.push(str); }
    section(title) { 
        this.lines.push('\n' + '='.repeat(60)); 
        this.lines.push(` ${title.toUpperCase()}`); 
        this.lines.push('='.repeat(60)); 
    }
    hexDump(view, limit = 128) {
        let output = [];
        const len = Math.min(view.byteLength, limit);
        
        for (let i = 0; i < len; i += 16) {
            let hex = '';
            let chars = '';
            
            for (let j = 0; j < 16; j++) {
                if (i + j < len) {
                    const b = view.getUint8(i + j);
                    hex += b.toString(16).padStart(2, '0') + ' ';
                    chars += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
                } else {
                    hex += '   ';
                }
            }
            output.push(`    ${(i).toString(16).padStart(4, '0')} | ${hex} | ${chars}`);
        }
        
        if (view.byteLength > limit) { output.push(`    ... (Total ${view.byteLength} bytes)`); }
        return output.join('\n');
    }
    get output() { return this.lines.join('\n'); }
}

// --- DECODERS ---
const decoders = {
    utf8: new TextDecoder('utf-8', { fatal: false }),
    utf16: new TextDecoder('utf-16le', { fatal: false }),
    win1252: new TextDecoder('windows-1252', { fatal: false })
};

function dataViewToStringDebug(view, encoding, logger, label) {
    const isPrintable = (s) => {
        if (!s || s.length === 0) return false;
        let printableCount = s.replace(/[^\x20-\x7E\n\r\t]/g, '').length;
        return (printableCount / s.length); // Return score 0-1
    };
    
    let res = null;
    let score = 0;
    try {
        if (encoding === 'utf16') {
            res = decoders.utf16.decode(view);
            const nullIdx = res.indexOf('\0');
            if (nullIdx > -1) res = res.substring(0, nullIdx);
        } else {
            res = decoders[encoding].decode(view);
            const nullIdx = res.indexOf('\0');
            if (nullIdx > -1) res = res.substring(0, nullIdx);
        }
        score = isPrintable(res);
    } catch (e) {
        res = `<Error: ${e.message}>`;
    }
    
    logger.add(`    > Try ${label.padEnd(10)}: "${res.substring(0, 40).replace(/\n/g, '\\n')}..."`);
    logger.add(`        Len: ${res.length} | Printable Score: ${(score * 100).toFixed(1)}%`);
    return res;
}

// --- PARSER ---
function MsgReaderDebugParser(arrayBuffer, logger) {
    this.buffer = arrayBuffer;
    this.dataView = new DataView(arrayBuffer);
    this.logger = logger;
    this.dirEntries = [];
    this.header = null;
    this.fat = [];
    this.miniFat = [];
    this._miniStreamData = null;
}

MsgReaderDebugParser.prototype.parse = function() {
    this.logger.section("1. File Header Check");
    
    // Signature Check
    const sig = this.dataView.getUint32(0, true);
    this.logger.add(`Signature: 0x${sig.toString(16).toUpperCase()} (Expected: 0xE011CFD0)`);
    
    if (sig !== 0xE011CFD0) {
        this.logger.add("!!! INVALID OLE SIGNATURE - Parsing as text/MIME");
        return this.parseMime();
    }

    // Read Header
    this.readHeader();
    this.logger.add(`Sector Shift: ${this.header.sectorShift} (Size: ${this.header.sectorSize})`);
    this.logger.add(`Mini Sector Shift: ${this.header.miniSectorShift} (Size: ${this.header.miniSectorSize})`);
    this.logger.add(`Directory Start Sector: ${this.header.directoryFirstSector}`);

    this.logger.section("2. FAT Chain Analysis");
    this.readFAT();
    this.readMiniFAT();
    this.logger.add(`FAT Entries: ${this.fat.length}`);
    this.logger.add(`MiniFAT Entries: ${this.miniFat ? this.miniFat.length : 0}`);

    this.logger.section("3. Directory Entries Scan");
    this.readDirectory();
    this.logger.add(`Total Directory Entries: ${this.dirEntries.length}`);

    // 3.5 Codepage Check
    const cpEntry = this.dirEntries.find(e => e.name.includes('3FDE'));
    if (cpEntry) {
        this.logger.add("\n  [Codepage Detected]");
        const data = this.readFullStream(cpEntry, cpEntry.size >= 4096);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.logger.add(`    PR_MESSAGE_CODEPAGE (0x3FDE): ${view.getInt32(0, true)}`);
    } else {
        this.logger.add("\n  [No Codepage Property (0x3FDE) Found]");
    }

    // 4. Property Analysis (Targeted)
    this.dirEntries.forEach((entry, idx) => {
        const name = entry.name;
        // Subject (0037), Body (1000), DisplayTo (0E04), DisplayCC (0E03), HTML (1013), RTF (1009)
        // Strings (001E, 001F)
        const interesting = ['0037', '1000', '1013', '1009', '0E04', '0E03', '001E', '001F'];
        if (interesting.some(k => name.includes(k))) {
             this.logger.add(`\n  [Entry ${idx}] ${name} | Size: ${entry.size} | Start: ${entry.startSector}`);
             this.analyzeProperty(entry);
        }
    });

    this.logger.section("5. Recipient Entries");
    const recipients = this.dirEntries.filter(e => e.name.includes('__recip_version1.0_'));
    if (recipients.length === 0) this.logger.add("No Recipient Storages found.");
    recipients.forEach((r, i) => {
        this.logger.add(`Recipient Storage ${i}: ${r.name} (ID: ${r.id})`);
        const children = this.findChildren(r.id);
        children.forEach(child => {
            if (child.name.includes('3001') || child.name.includes('3003') || 
                child.name.includes('39FE') || child.name.includes('0C15')) {
                
                this.logger.add(`    Property: ${child.name} (Size: ${child.size})`);
                const data = this.readFullStream(child, child.size >= 4096);
                if (data.length > 0 && data.length < 128) {
                    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                    if (child.name.includes('0C15')) {
                        this.logger.add(`        Value (Int32): ${view.getInt32(0, true)}`);
                    } else {
                        const s = dataViewToStringDebug(view, child.name.endsWith('001F') ? 'utf16' : 'utf8', this.logger, 'RecipVal');
                    }
                }
            }
        });
    });

    this.logger.section("6. Full Property Inventory (Hierarchy)");
    // Flattened hierarchy dump to see where data hides
    const dumpTree = (parentId, depth) => {
        const children = this.findChildren(parentId);
        children.forEach(c => {
            const indent = '  '.repeat(depth);
            this.logger.add(`${indent}- ${c.name} (Type: ${c.type}, Size: ${c.size})`);
            if (c.type === 1) { // Storage
                dumpTree(c.id, depth + 1);
            }
        });
    };
    const root = this.dirEntries.find(e => e.type === 5);
    if (root) {
        this.logger.add("ROOT");
        dumpTree(root.id, 1);
    }

    return this.logger.output;
};

// --- OLE READ HELPERS ---

MsgReaderDebugParser.prototype.readHeader = function() {
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

MsgReaderDebugParser.prototype.readFAT = function() {
    let sectorSize = this.header.sectorSize, entriesPerSector = sectorSize / 4;
    this.fat = [];
    let fatSectorPositions = [];
    for (let i = 0; i < 109 && i < this.header.fatSectors; i++) {
        let s = this.dataView.getUint32(76 + i * 4, true);
        if (s !== 0xFFFFFFFE && s !== 0xFFFFFFFF) fatSectorPositions.push(s);
    }
    if (this.header.difTotalSectors > 0) {
        let difSector = this.header.difFirstSector;
        while (difSector !== 0xFFFFFFFE && difSector !== 0xFFFFFFFF) {
            let difOffset = 512 + difSector * sectorSize;
            for (let j = 0; j < entriesPerSector - 1; j++) {
                let s = this.dataView.getUint32(difOffset + j * 4, true);
                if (s !== 0xFFFFFFFE && s !== 0xFFFFFFFF) fatSectorPositions.push(s);
            }
            difSector = this.dataView.getUint32(difOffset + (entriesPerSector - 1) * 4, true);
        }
    }
    for (let i = 0; i < fatSectorPositions.length; i++) {
        let offset = 512 + fatSectorPositions[i] * sectorSize;
        for (let j = 0; j < entriesPerSector; j++) {
            if (offset + j * 4 + 4 <= this.buffer.byteLength) this.fat.push(this.dataView.getUint32(offset + j * 4, true));
        }
    }
};

MsgReaderDebugParser.prototype.readMiniFAT = function() {
    if (this.header.miniFatFirstSector === 0xFFFFFFFE) { this.miniFat = []; return; }
    this.miniFat = [];
    let sector = this.header.miniFatFirstSector, sectorSize = this.header.sectorSize;
    while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF) {
        let offset = 512 + sector * sectorSize;
        for (let i = 0; i < sectorSize / 4; i++) {
            if (offset + i * 4 + 4 <= this.buffer.byteLength) this.miniFat.push(this.dataView.getUint32(offset + i * 4, true));
        }
        if (sector >= this.fat.length) break;
        sector = this.fat[sector];
    }
};

MsgReaderDebugParser.prototype.readDirectory = function() {
    let sector = this.header.directoryFirstSector, sectorSize = this.header.sectorSize, entrySize = 128;
    while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF) {
        let offset = 512 + sector * sectorSize;
        for (let i = 0; i < sectorSize / entrySize; i++) {
            let entryOffset = offset + i * entrySize;
            if (entryOffset + entrySize > this.buffer.byteLength) break;
            
            let nameLen = this.dataView.getUint16(entryOffset + 64, true);
            let type = this.dataView.getUint8(entryOffset + 66);
            
            if (nameLen > 0) {
                let nameView = new DataView(this.buffer, entryOffset, Math.min(nameLen, 64));
                let name = decoders.utf16.decode(nameView).replace(/\0/g, '');
                
                this.dirEntries.push({
                    id: this.dirEntries.length,
                    name: name,
                    type: type,
                    startSector: this.dataView.getUint32(entryOffset + 116, true),
                    size: this.dataView.getUint32(entryOffset + 120, true),
                    leftSiblingId: this.dataView.getInt32(entryOffset + 68, true),
                    rightSiblingId: this.dataView.getInt32(entryOffset + 72, true),
                    childId: this.dataView.getInt32(entryOffset + 76, true)
                });
            } else {
                this.dirEntries.push({ id: this.dirEntries.length, name: null, childId: -1 });
            }
        }
        if (sector >= this.fat.length) break;
        sector = this.fat[sector];
    }
    this.dirEntries.forEach((de, idx) => de.id = idx);
};

MsgReaderDebugParser.prototype.readFullStream = function(entry, isStandard) {
    const data = new Uint8Array(entry.size);
    let dataOffset = 0;
    let sector = entry.startSector;
    const sectorSize = isStandard ? this.header.sectorSize : this.header.miniSectorSize;
    const chain = isStandard ? this.fat : this.miniFat;
    
    let sourceData = this.dataView;
    let baseOffset = 512;
    
    if (!isStandard) {
        if (!this._miniStreamData) {
            const root = this.dirEntries.find(e => e.type === 5);
            if (root) {
                this._miniStreamData = this.readFullStream(root, true);
            } else {
                return new Uint8Array(0);
            }
        }
        baseOffset = 0;
    }

    let iterations = 0;
    while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && dataOffset < entry.size) {
        if (iterations++ > 5000) break;
        
        let offset = baseOffset + (sector * sectorSize);
        let copy = Math.min(sectorSize, entry.size - dataOffset);

        for (let i = 0; i < copy; i++) {
            if (!isStandard) {
                data[dataOffset++] = this._miniStreamData[offset + i];
            } else {
                data[dataOffset++] = this.dataView.getUint8(offset + i);
            }
        }
        
        if (sector >= chain.length) break;
        sector = chain[sector];
    }
    return data;
};

MsgReaderDebugParser.prototype.findChildren = function(parentId) {
    let parent = this.dirEntries[parentId];
    if (!parent || parent.childId === -1) return [];
    let children = [];
    let stack = [parent.childId];
    let visited = new Set();
    
    while (stack.length > 0) {
        let id = stack.pop();
        if (id === -1 || visited.has(id)) continue;
        visited.add(id);
        let entry = this.dirEntries[id];
        if (!entry) continue;
        children.push(entry);
        if (entry.leftSiblingId !== -1) stack.push(entry.leftSiblingId);
        if (entry.rightSiblingId !== -1) stack.push(entry.rightSiblingId);
    }
    return children;
};

MsgReaderDebugParser.prototype.analyzeProperty = function(entry) {
    this.logger.add(`    >>> ANALYZING PROPERTY: ${entry.name} <<<`);
    
    const name = entry.name;
    const typeCode = name.substring(name.length - 4);
    const typeMap = {
        '001E': 'STRING8 (8-bit, likely Win-1252 or UTF-8)',
        '001F': 'UNICODE (16-bit LE)',
        '0102': 'BINARY',
        '0003': 'INTEGER32',
        '000B': 'BOOLEAN'
    };
    this.logger.add(`    Type Code: ${typeCode} -> ${typeMap[typeCode] || 'Unknown'}`);

    if (entry.size <= 0) { this.logger.add("    Empty stream."); return; }
    
    let propData = null;
    const isMini = entry.size < 4096;

    propData = this.readFullStream(entry, !isMini);
    
    if (!propData || propData.length === 0) {
        this.logger.add("    ! Failed to read property data.");
        return;
    }

    const propView = new DataView(propData.buffer, propData.byteOffset, propData.byteLength);
    
    this.logger.add(`    HEX DUMP (First 128 bytes):`);
    this.logger.add(this.logger.hexDump(propView, 128));
    
    if (typeCode === '001E' || typeCode === '001F') {
        this.logger.add("    --- DECODING ATTEMPTS ---");
        dataViewToStringDebug(propView, 'utf16', this.logger, 'UTF-16LE');
        dataViewToStringDebug(propView, 'utf8', this.logger, 'UTF-8');
        dataViewToStringDebug(propView, 'win1252', this.logger, 'Win-1252');
    }
};

MsgReaderDebugParser.prototype.parseMime = function() {
    const text = decoders.utf8.decode(new DataView(this.buffer));
    this.logger.add("\n--- MIME SCAN ---");
    this.logger.add(`First 500 chars:\n${text.substring(0, 500)}`);
    
    const subj = text.match(/\bSubject:\s*([^\r\n]+)/i);
    this.logger.add(`RegEx Subject: ${subj ? subj[1] : 'Not Found'}`);
    
    return this.logger.output;
};

export const MsgReaderDebug = {
    generateReport: function(arrayBuffer) {
        const logger = new LogBuffer();
        logger.section("MSG READER DEBUG REPORT v3.0 (DEEP INSPECT)");
        logger.add(`File Size: ${arrayBuffer.byteLength} bytes`);
        
        const parser = new MsgReaderDebugParser(arrayBuffer, logger);
        return parser.parse();
    }
};
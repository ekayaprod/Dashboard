/**
 * js/msgreader-debug.js
 * Special Instrumented Version for QA
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
    hexDump(view, limit = 32) {
        let hex = '';
        let chars = '';
        const len = Math.min(view.byteLength, limit);
        for (let i = 0; i < len; i++) {
            const b = view.getUint8(i);
            hex += b.toString(16).padStart(2, '0') + ' ';
            chars += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
        }
        if (view.byteLength > limit) { hex += '...'; chars += '...'; }
        return `[Len: ${view.byteLength}] HEX: ${hex}  ASCII: ${chars}`;
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
    const isPrintable = (s) => (s.replace(/[^\x20-\x7E]/g, '').length / s.length) > 0.7;
    
    let res = null;
    try {
        if (encoding === 'utf16') {
            res = decoders.utf16.decode(view);
            // Manual check for nulls
            const nullIdx = res.indexOf('\0');
            if (nullIdx > -1) res = res.substring(0, nullIdx);
        } else {
            res = decoders[encoding].decode(view);
            const nullIdx = res.indexOf('\0');
            if (nullIdx > -1) res = res.substring(0, nullIdx);
        }
    } catch (e) {
        res = `<Error: ${e.message}>`;
    }
    
    logger.add(`    > Try ${label.padEnd(10)}: "${res.substring(0, 30).replace(/\n/g, '\\n')}..." (Len: ${res.length}, Printable: ${res ? isPrintable(res) : 'N/A'})`);
    return res;
}

// --- PARSER ---
function MsgReaderDebugParser(arrayBuffer, logger) {
    this.buffer = arrayBuffer;
    this.view = new DataView(arrayBuffer);
    this.logger = logger;
    this.dirEntries = [];
}

MsgReaderDebugParser.prototype.parse = function() {
    this.logger.section("1. File Header Check");
    
    // Signature Check
    const sig = this.view.getUint32(0, true);
    this.logger.add(`Signature: 0x${sig.toString(16).toUpperCase()} (Expected: 0xE011CFD0)`);
    
    if (sig !== 0xE011CFD0) {
        this.logger.add("!!! INVALID OLE SIGNATURE - Parsing as text/MIME");
        return this.parseMime();
    }

    // Header Params
    const sectorShift = this.view.getUint16(30, true);
    const sectorSize = 1 << sectorShift;
    const dirStart = this.view.getUint32(48, true);
    
    this.logger.add(`Sector Shift: ${sectorShift} (Size: ${sectorSize})`);
    this.logger.add(`Directory Start Sector: ${dirStart}`);

    // Read Directory (Simulated simplified read for debug)
    this.logger.section("2. Directory Entries Scan");
    
    // We will do a raw scan of the directory sectors just to find Property Tags
    // Note: This debug version assumes standard OLE structure without complex fragmentation for simplicity
    
    // Calculate offset of directory
    // OLE Header is 512 bytes. Sector 0 starts at 512.
    const getOffset = (sect) => 512 + (sect * sectorSize);
    
    let currentDirSector = dirStart;
    let entryCount = 0;

    while (currentDirSector !== 0xFFFFFFFE && currentDirSector !== 0xFFFFFFFF && entryCount < 100) {
        const offset = getOffset(currentDirSector);
        this.logger.add(`Reading Directory Sector ${currentDirSector} @ Offset ${offset}`);
        
        for (let i = 0; i < (sectorSize / 128); i++) {
            const entryOff = offset + (i * 128);
            const nameLen = this.view.getUint16(entryOff + 64, true);
            const type = this.view.getUint8(entryOff + 66);
            
            if (nameLen > 0) {
                // Decode Name
                const nameView = new DataView(this.buffer, entryOff, Math.min(nameLen, 64));
                const name = decoders.utf16.decode(nameView).replace(/\0/g, '');
                
                const size = this.view.getUint32(entryOff + 120, true);
                const startSect = this.view.getUint32(entryOff + 116, true);
                
                this.logger.add(`  [Entry ${entryCount}] Type: ${type} | Name: "${name}" | Size: ${size} | Start: ${startSect}`);
                
                // Check if it's a property we care about
                // Subject: 0037, Body: 1000
                if (name.includes('0037') || name.includes('1000') || name.includes('001E') || name.includes('001F')) {
                     this.analyzeProperty(name, size, startSect, sectorSize);
                }
            }
            entryCount++;
        }
        
        // Just break after first sector for debug safety unless we follow FAT (which is complex for single-file debug)
        // For the purpose of "why is subject 1 char", the header entry is usually in the first sector of directory.
        break; 
    }
    
    return this.logger.output;
};

MsgReaderDebugParser.prototype.analyzeProperty = function(name, size, startSector, sectorSize) {
    this.logger.add(`    >>> ANALYZING PROPERTY: ${name} <<<`);
    
    if (size <= 0) { this.logger.add("    Empty stream."); return; }
    
    // Determine where data is
    let dataOffset = 0;
    let isMini = size < 4096; 
    
    // Note: Full FAT traversal is omitted in debug for brevity; we assume contiguous for small files or just look at first sector
    if (!isMini) {
        dataOffset = 512 + (startSector * sectorSize);
        this.logger.add(`    Standard Stream @ ${dataOffset}`);
    } else {
        this.logger.add(`    Mini Stream (requires Root Entry lookup - skipping deep fetch for logic check, assuming raw read check only if standard)`);
        // For debug, we might not be able to easily resolve mini-stream without full FAT chain logic
        // But we can try to deduce if the issue is encoding.
        return; 
    }
    
    if (dataOffset + size > this.buffer.byteLength) {
        this.logger.add("    ! Data offset out of bounds.");
        return;
    }

    const propView = new DataView(this.buffer, dataOffset, Math.min(size, 64)); // Read first 64 bytes
    
    this.logger.add(`    ${this.logger.hexDump(propView)}`);
    
    // Perform decoding tests
    const u16 = dataViewToStringDebug(propView, 'utf16', this.logger, 'UTF-16LE');
    const u8 = dataViewToStringDebug(propView, 'utf8', this.logger, 'UTF-8');
    const win = dataViewToStringDebug(propView, 'win1252', this.logger, 'Win-1252');
    
    this.logger.add("    --- Decision Logic Simulation ---");
    const isP = (s) => (s && s.length > 0);
    
    if (name.endsWith('001E')) {
         this.logger.add("    Type: 001E (MAPI_STRING - Should be 8-bit)");
         if (isP(u16) && !isP(u8)) this.logger.add("    ! ALERT: Valid UTF-16 detected in 001E field.");
    } else if (name.endsWith('001F')) {
         this.logger.add("    Type: 001F (MAPI_UNICODE - Should be 16-bit)");
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
        logger.section("MSG READER DEBUG REPORT v1.0");
        logger.add(`File Size: ${arrayBuffer.byteLength} bytes`);
        
        const parser = new MsgReaderDebugParser(arrayBuffer, logger);
        return parser.parse();
    }
};
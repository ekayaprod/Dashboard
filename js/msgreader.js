/**
 * msg-reader.js v1.4.0
 * Production-grade Microsoft Outlook MSG and OFT file parser
 * Compatible with Outlook 365 and modern MSG formats
 * 
 * Based on msg.reader by Peter Theill
 * Licensed under MIT
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
    var PROP_TYPE_STRING = 0x001E;
    var PROP_TYPE_STRING8 = 0x001F;
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
        } else {
            // ASCII/UTF-8
            for (var i = 0; i < length; i++) {
                var charCode = view.getUint8(i);
                if (charCode === 0) break;
                result += String.fromCharCode(charCode);
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

        while (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sectorsRead < 1000) {
            var sectorOffset = 512 + sector * sectorSize;
            
            for (var i = 0; i < entriesPerSector; i++) {
                var offset = sectorOffset + i * 4;
                if (offset + 4 <= this.buffer.byteLength) {
                    this.miniFat.push(this.dataView.getUint32(offset, true));
                }
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

            sector = this.fat[sector];
            sectorsRead++;
        }

        console.log('Directory entries:', this.directoryEntries.length);
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

        return {
            name: name,
            type: type, // 1=storage, 2=stream, 5=root
            startSector: startSector,
            size: size
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

                sector = this.fat[sector];
                sectorsRead++;
            }
        }

        return data.slice(0, dataOffset);
    };

    MsgReader.prototype.extractProperties = function() {
        var self = this;

        // Find property streams
        this.directoryEntries.forEach(function(entry) {
            if (entry.name.indexOf('__substg1.0_') === 0) {
                var propTag = entry.name.substring(12, 20);
                var propId = parseInt(propTag.substring(0, 4), 16);
                var propType = parseInt(propTag.substring(4, 8), 16);

                var streamData = self.readStream(entry);
                var value = self.convertPropertyValue(streamData, propType);

                self.properties[propId] = {
                    id: propId,
                    type: propType,
                    value: value
                };
            }
        });

        // Extract recipients
        this.extractRecipients();

        console.log('Extracted properties:', Object.keys(this.properties).length);
    };

    MsgReader.prototype.convertPropertyValue = function(data, type) {
        if (!data || data.length === 0) {
            return null;
        }

        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        switch (type) {
            case PROP_TYPE_STRING8: // UTF-16LE string
                return dataViewToString(view, 'utf16le');

            case PROP_TYPE_STRING: // ASCII string
                return dataViewToString(view, 'ascii');

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

            case PROP_TYPE_BINARY:
                return data;

            default:
                return data;
        }
    };

    MsgReader.prototype.extractRecipients = function() {
        var self = this;
        var recipients = [];

        // Find recipient directories
        var recipientDirs = this.directoryEntries.filter(function(entry) {
            return entry.type === 1 && entry.name.indexOf('__recip_version1.0_') === 0;
        });

        recipientDirs.forEach(function(recipDir) {
            var recipient = {
                recipientType: null,
                name: null,
                email: null
            };

            // Find properties for this recipient
            var recipPrefix = recipDir.name + '/';
            
            self.directoryEntries.forEach(function(entry) {
                if (entry.name.indexOf(recipPrefix + '__substg1.0_') === 0) {
                    var propTag = entry.name.substring(recipPrefix.length + 12, recipPrefix.length + 20);
                    var propId = parseInt(propTag.substring(0, 4), 16);
                    var propType = parseInt(propTag.substring(4, 8), 16);

                    var streamData = self.readStream(entry);
                    var value = self.convertPropertyValue(streamData, propType);

                    // 0x0C15 = Display name
                    if (propId === 0x0C15 || propId === 0x3001) {
                        recipient.name = value;
                    }
                    // 0x39FE = SMTP address
                    else if (propId === 0x39FE || propId === 0x5D01) {
                        recipient.email = value;
                    }
                    // 0x0E03 = Recipient type
                    else if (propId === 0x0C15) {
                        recipient.recipientType = value;
                    }
                }
            });

            if (recipient.name || recipient.email) {
                recipients.push(recipient);
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

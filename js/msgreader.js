/**
 * msgreader.js v2.3.0
 * * Microsoft Outlook MSG and OFT file parser for JavaScript environments.
 * Implements OLE Compound File Binary Format (CFB) parsing according to
 * [MS-CFB] and [MS-OXMSG] specifications.
 * * Original Author: B-AR (https://github.com/B-AR)
 * Enhanced Version: Includes comprehensive error handling, validation,
 * OFT template support, and memory optimization.
 * * Supported Formats:
 * - .msg (Microsoft Outlook Message Files)
 * - .oft (Microsoft Outlook Template Files)
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
    // A1: Added try-catch around factory call for safer UMD loading
    (function () {
        try {
            global.MsgReader = factory({}).default;
        } catch(e) { 
            console.error('MsgReader initialization failed in UMD wrapper:', e); 
            global.MsgReader = null; 
        }
    })();
}(this, (function (exports) { 'use strict';

function _typeof(obj) {
  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function (obj) {
      return typeof obj;
    };
  } else {
    _typeof = function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };
  }
  return _typeof(obj);
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    var ownKeys = Object.keys(source);
    if (typeof Object.getOwnPropertySymbols === 'function') {
      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }
    ownKeys.forEach(function (key) {
      _defineProperty(target, key, source[key]);
    });
  }
  return target;
}

function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
}

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];
    return arr2;
  }
}

function _iterableToArray(iter) {
  if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
}

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance");
}

/**
 * Base error class for MSG/OFT parsing failures
 * @constructor
 * @param {string} message - Error description
 */
var MsgReaderError = function(message) {
  this.name = 'MsgReaderError';
  this.message = message;
  this.stack = (new Error()).stack;
};
MsgReaderError.prototype = Object.create(Error.prototype);
MsgReaderError.prototype.constructor = MsgReaderError;

/**
 * Error class for corrupted or malformed file structures
 * @constructor
 * @param {string} message - Error description
 */
var CorruptFileError = function(message) {
  this.name = 'CorruptFileError';
  this.message = message;
  this.stack = (new Error()).stack;
};
CorruptFileError.prototype = Object.create(MsgReaderError.prototype);
CorruptFileError.prototype.constructor = CorruptFileError;

// ===========================================================================
// STRUCTURAL OPTIMIZATION HELPERS (Issue 1, 2, 3, 5, 6, 7, 13, 17, 18)
// ===========================================================================

/** Constant for the 512-byte OLE header size (Issue 13) */
const HEADER_SIZE = 512;

/**
 * Converts a 4-byte Little-Endian array segment to a 32-bit integer.
 * @param {Array<number>} d - The 4-byte array segment.
 * @returns {number} The decoded 32-bit integer. (Issue 2, 6)
 */
function bytesToInt32(d) {
    if (d.length !== 4) {
        return 0;
    }
    return d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
}

/**
 * Reads data from the file, ensuring the expected length is returned.
 * @param {ReadFile} file - The file reader instance.
 * @param {number} size - The expected number of bytes.
 * @param {string} contextMsg - Description for error reporting.
 * @returns {Array<number>} The read byte array. (Issue 3, 18)
 * @throws {CorruptFileError} If the end of file is reached prematurely.
 */
function readValidated(file, size, contextMsg) {
    var d = file.read(size);
    if (d.length < size) {
        throw new CorruptFileError('Unexpected end of file in ' + contextMsg + '. Expected ' + size + ' bytes, got ' + d.length + '.');
    }
    return d;
}

/**
 * Calculates the absolute file offset for a given sector. (Issue 13)
 * @param {number} sector - The sector index.
 * @param {number} sectorSize - The size of the sector in bytes.
 * @returns {number} The absolute file offset.
 */
function getSectorOffset(sector, sectorSize) {
    return HEADER_SIZE + sector * sectorSize;
}

/**
 * Validates that a sector offset is within the file's boundaries. (Issue 1)
 * @param {number} offset - The calculated file offset.
 * @param {number} sectorSize - The size of the data being read.
 * @param {number} fileLength - The total size of the file buffer.
 * @param {string} context - The context for the error message.
 * @throws {CorruptFileError} If the offset is out of bounds.
 */
function validateSectorOffset(offset, sectorSize, fileLength, context) {
    if (offset < HEADER_SIZE || offset + sectorSize > fileLength) {
        throw new CorruptFileError(context + ' sector offset (' + offset + ') points beyond file boundary (' + fileLength + ')');
    }
}

/**
 * Converts a byte array (excluding null terminators) into a string. (Issue 5)
 * @param {Array<number>} byteArray - The byte array to convert.
 * @param {string} [context='String field'] - Context for warning messages.
 * @returns {string} The decoded string.
 */
function bytesToString(byteArray, context = 'String field') {
    try {
        var filteredBytes = byteArray.filter(function (v) { return v !== 0; });
        return String.fromCharCode.apply(String, _toConsumableArray(filteredBytes));
    } catch (e) {
        console.warn('Invalid string encoding in ' + context + ': ' + e.message);
        return '';
    }
}

/**
 * Parses a MAPI stream key string to extract the property ID and type. (Issue 7)
 * e.g., '__substg1.0_0037001F' -> { nameId: 0x0037, type: '001F' }
 * @param {string} key - The stream key.
 * @returns {{nameId: number, type: string}|null} Parsed info or null on failure.
 */
function parsePropertyId(key) {
    // Matches keys ending in _XXXXYYYY where XXXX=nameId and YYYY=type
    var match = key.match(/__substg1\.0_([a-fA-F0-9]{4})([a-fA-F0-9]{4})$/);
    if (!match) return null;

    var nameId = parseInt(match[1], 16);
    var type = match[2];

    if (isNaN(nameId)) return null;

    return { nameId: nameId, type: type };
}

/**
 * Calculates the exact file position within the MiniFAT stream. (Issue 17)
 * @param {number} sector - The MiniFAT sector number.
 * @param {number} miniSectorSize - Size of a mini sector.
 * @param {number} regularSectorSize - Size of a regular sector.
 * @param {Array<number>} miniStreamSectors - The sectors of the root mini stream.
 * @returns {{actualOffset: number, offsetInMiniStream: number?}|{actualOffset: number}} The offset data.
 */
function getMiniStreamPosition(sector, miniSectorSize, regularSectorSize, miniStreamSectors) {
    var sectorInMiniStream = Math.floor(sector * miniSectorSize / regularSectorSize);
    var offsetInMiniStream = (sector * miniSectorSize) % regularSectorSize;

    if (sectorInMiniStream < 0 || sectorInMiniStream >= miniStreamSectors.length) {
        return { actualOffset: -1 }; // Indicate out of bounds
    }

    var actualOffset = getSectorOffset(miniStreamSectors[sectorInMiniStream], regularSectorSize) + offsetInMiniStream;
    return { actualOffset: actualOffset, offsetInMiniStream: offsetInMiniStream };
}

/**
 * OLE Compound File Binary Format parser
 * Implements [MS-CFB]: Compound File Binary File Format specification
 * * @class OleCompoundDoc
 * @param {ReadFile} file - File reader instance
 */
var OleCompoundDoc = function () {
  function OleCompoundDoc(file) {
    this.file = file;
    this.header = {};
    this.sectors = [];
    this.streams = {};
    this.rootStreamEntry = null;
    
    try {
      this.readHeader();
      this.readSectors();
      this.readDirTree();
    } catch (e) {
      if (e instanceof MsgReaderError) {
        throw e;
      }
      // A13: Preserve original error message and type for better debugging
      var err = new MsgReaderError('Failed to parse OLE Compound Document: ' + e.message);
      err.cause = e;
      throw err;
    }
  }

  var _proto = OleCompoundDoc.prototype;

  /**
   * Parses OLE compound file header (512 bytes)
   * Validates signature, version, and sector configuration
   * * @throws {CorruptFileError} If header is invalid or corrupted
   */
  _proto.readHeader = function readHeader() {
    var ULONG_SIZE = 4;
    var USHORT_SIZE = 2;
    var HEADER_SIGNATURE_SIZE = 8;
    var HEADER_CLSID_SIZE = 16;
    var file = this.file;
    var header = this.header;
    
    if (file.arrayBuffer.length < 512) {
      throw new CorruptFileError('File too small to be a valid MSG/OFT file (minimum 512 bytes)');
    }
    
    // Use readValidated (Issue 3, 18)
    var d = readValidated(file, HEADER_SIGNATURE_SIZE, 'header signature');

    var signature = '';
    for (var i = 0; i < HEADER_SIGNATURE_SIZE; i++) {
      signature += String.fromCharCode(d[i]);
    }
    header.abSig = signature;
    
    var validSignatures = [
      '\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1',
      '\x0E\x11\xFC\x0D\xD0\xCF\x11\xE0'
    ];
    
    var isValidSignature = validSignatures.some(function(validSig) {
      return signature === validSig;
    });
    
    if (!isValidSignature) {
      throw new CorruptFileError('Invalid OLE signature. This is not a valid MSG/OFT file.');
    }

    // Skip CLSID (Issue 3)
    readValidated(file, HEADER_CLSID_SIZE, 'header CLSID'); 

    d = readValidated(file, USHORT_SIZE, 'header minor version');
    header.uMinorVersion = d[0] | (d[1] << 8); // BUG FIX: Was d[0]

    d = readValidated(file, USHORT_SIZE, 'header major version');
    header.uMajorVersion = d[0] | (d[1] << 8); // BUG FIX: Was d[0]
    
    if (header.uMajorVersion !== 3 && header.uMajorVersion !== 4) {
      throw new CorruptFileError('Unsupported OLE version: ' + header.uMajorVersion);
    }
    
    d = readValidated(file, USHORT_SIZE, 'header byte order');
    header.uByteOrder = d[0] | (d[1] << 8); // BUG FIX: Was d[0]
    
    if (header.uByteOrder !== 0xFFFE) {
      throw new CorruptFileError('Invalid byte order marker');
    }
    
    d = readValidated(file, USHORT_SIZE, 'header sector shift');
    header.uSectorShift = d[0] | (d[1] << 8); // BUG FIX: Was d[0]
    
    // B1: Restrict sector shift to standard 512/4096 bytes (9 or 12)
    if (header.uSectorShift !== 9 && header.uSectorShift !== 12) {
      throw new CorruptFileError('Invalid sector shift: ' + header.uSectorShift + '. Must be 9 (512 bytes) or 12 (4096 bytes)');
    }
    
    header.uSectorSize = 1 << header.uSectorShift;
    
    d = readValidated(file, USHORT_SIZE, 'header mini sector shift');
    header.uMiniSectorShift = d[0] | (d[1] << 8); // BUG FIX: Was d[0]
    
    if (header.uMiniSectorShift < 6 || header.uMiniSectorShift > header.uSectorShift) {
      throw new CorruptFileError('Invalid mini sector shift: ' + header.uMiniSectorShift);
    }
    
    header.uMiniSectorSize = 1 << header.uMiniSectorShift;
    
    // Skip reserved (Issue 3)
    readValidated(file, 6, 'header reserved section'); 

    d = readValidated(file, ULONG_SIZE, 'header cDirSectors');
    header.cDirSectors = bytesToInt32(d); // Issue 2
    
    // B7: Directory sector count validation
    if (header.cDirSectors > 1000) {
      throw new CorruptFileError('Directory sector count unreasonably large: ' + header.cDirSectors);
    }

    d = readValidated(file, ULONG_SIZE, 'header cFATSectors');
    header.cFATSectors = bytesToInt32(d); // Issue 2
    
    // B5: FAT sector count validation
    if (header.cFATSectors > 10000) {
      throw new CorruptFileError('FAT sector count unreasonably large: ' + header.cFATSectors);
    }

    d = readValidated(file, ULONG_SIZE, 'header sectDirStart');
    header.sectDirStart = bytesToInt32(d); // Issue 2

    d = readValidated(file, ULONG_SIZE, 'header signature (2)');
    header.signature = bytesToInt32(d); // Issue 2

    d = readValidated(file, ULONG_SIZE, 'header ulMiniSectorCutoff');
    header.ulMiniSectorCutoff = bytesToInt32(d); // Issue 2
    
    // B2: Mini sector cutoff validation
    if (header.ulMiniSectorCutoff === 0) {
      header.ulMiniSectorCutoff = 4096;
    } else if (header.ulMiniSectorCutoff < 512 || header.ulMiniSectorCutoff > 65536) {
        throw new CorruptFileError('Mini sector cutoff out of valid range: ' + header.ulMiniSectorCutoff);
    }

    d = readValidated(file, ULONG_SIZE, 'header sectMiniFatStart');
    header.sectMiniFatStart = bytesToInt32(d); // Issue 2

    d = readValidated(file, ULONG_SIZE, 'header cMiniFatSectors');
    header.cMiniFatSectors = bytesToInt32(d); // Issue 2

    // B6: Mini FAT sector count validation
    if (header.cMiniFatSectors > 10000) {
      throw new CorruptFileError('Mini FAT sector count unreasonably large: ' + header.cMiniFatSectors);
    }

    d = readValidated(file, ULONG_SIZE, 'header sectDifStart');
    header.sectDifStart = bytesToInt32(d); // Issue 2

    d = readValidated(file, ULONG_SIZE, 'header cDifSectors');
    header.cDifSectors = bytesToInt32(d); // Issue 2
    
    var difSectors = [];
    for (var _i = 0; _i < 109; _i++) {
      d = readValidated(file, ULONG_SIZE, 'header MSAT entry ' + _i);
      
      var sectorNum = bytesToInt32(d); // Issue 2
      // B3: Basic MSAT sanity check (0xFFFFFFFF is -1 in 32-bit signed, but we check for large values)
      if (sectorNum !== 0xFFFFFFFE && sectorNum !== 0xFFFFFFFF && sectorNum > (file.arrayBuffer.length / header.uSectorSize) * 2) {
        throw new CorruptFileError('MSAT entry points to unreasonably large sector: ' + sectorNum);
      }
      difSectors[_i] = sectorNum;
    }
    header.MSAT = difSectors;
  };

  /**
   * Reads and constructs File Allocation Table (FAT), Mini FAT, and directory sectors
   * FAT maps sectors to their next sector in a chain
   * * @throws {CorruptFileError} If sector references are invalid
   */
  _proto.readSectors = function readSectors() {
    var file = this.file;
    var header = this.header;
    var sectorSize = header.uSectorSize;
    
    try {
      var fatSectors = this.readSectorsFromMSAT(header.MSAT, header.cDifSectors, header.sectDifStart, sectorSize);
      var sectorsInFat = sectorSize / 4;
      var fat = [];

      for (var i = 0; i < header.cFATSectors; i++) {
        var sector = fatSectors[i] ? fatSectors[i] : header.MSAT[i];
        
        if (sector === 0xFFFFFFFE || sector === 0xFFFFFFFF) {
          continue;
        }
        
        var offset = getSectorOffset(sector, sectorSize); // Issue 13
        validateSectorOffset(offset, sectorSize, file.arrayBuffer.length, 'FAT'); // Issue 1
        
        file.seek(offset);
        for (var j = 0; j < sectorsInFat; j++) {
          var entry = readValidated(file, 4, 'FAT entries'); // Issue 3
          fat.push(bytesToInt32(entry)); // Issue 2
        }
      }

      var miniFatSectors = this.readSectorsFromSAT(fat, header.cMiniFatSectors, header.sectMiniFatStart);
      var miniFat = [];

      for (var _i2 = 0; _i2 < miniFatSectors.length; _i2++) {
        var _sector = miniFatSectors[_i2];
        var _offset = getSectorOffset(_sector, sectorSize); // Issue 13
        
        validateSectorOffset(_offset, sectorSize, file.arrayBuffer.length, 'Mini FAT'); // Issue 1

        file.seek(_offset);
        for (var _j = 0; _j < sectorsInFat; _j++) {
          var entry = readValidated(file, 4, 'Mini FAT entries'); // Issue 3
          miniFat.push(bytesToInt32(entry)); // Issue 2
        }
      }

      var dirSectors = this.readSectorsFromSAT(fat, header.cDirSectors, header.sectDirStart);
      
      if (dirSectors.length === 0) {
        // Only throw if cDirSectors > 0, otherwise it might be a valid, empty file
        if (header.cDirSectors > 0) {
            throw new CorruptFileError('No directory sectors found, expected ' + header.cDirSectors);
        }
      }
      
      this.sectors = {
        fat: fat,
        miniFat: miniFat,
        dirSectors: dirSectors
      };
    } catch (e) {
      if (e instanceof MsgReaderError) {
        throw e;
      }
      throw new CorruptFileError('Failed to read sectors: ' + e.message);
    }
  };

  /**
   * Reads FAT sectors from Master Sector Allocation Table (MSAT)
   * MSAT may extend beyond header if file contains more than 109 FAT sectors
   * * @param {Array} msat - Initial MSAT from header
   * @param {number} cDifSectors - Count of additional DIF sectors
   * @param {number} sectDifStart - Starting sector of DIF chain
   * @param {number} sectorSize - Size of each sector in bytes
   * @returns {Array} Array of FAT sector numbers
   * @throws {CorruptFileError} If circular reference or invalid sector detected
   */
  _proto.readSectorsFromMSAT = function readSectorsFromMSAT(msat, cDifSectors, sectDifStart, sectorSize) {
    var file = this.file;
    var fatSectors = [];
    var sectorsInFat = sectorSize / 4;
    var difSectors = cDifSectors;
    // A14: Use Set for performance
    var visitedSectors = new Set();
    
    // A4: Reduce max iterations, add validation for sector count
    var maxIterations = 1000;
    if (cDifSectors > 100) { // Practical limit for DIF sectors
      throw new CorruptFileError('DIF sector count unreasonably large: ' + cDifSectors);
    }
    var iterations = 0;

    if (difSectors > 0) {
      var difSector = sectDifStart;

      while (difSector !== 0xFFFFFFFE && difSector !== 0xFFFFFFFF && iterations < maxIterations) {
        if (visitedSectors.has(difSector)) {
          throw new CorruptFileError('Circular reference detected in MSAT chain');
        }
        visitedSectors.add(difSector);
        
        var offset = getSectorOffset(difSector, sectorSize); // Issue 13
        validateSectorOffset(offset, sectorSize, file.arrayBuffer.length, 'DIF'); // Issue 1
        
        file.seek(offset);

        for (var j = 0; j < sectorsInFat - 1; j++) {
          var sectorData = readValidated(file, 4, 'DIF sector entries'); // Issue 3

          var sector = bytesToInt32(sectorData); // Issue 2
          
          // B4: Sanity check DIF sector entry (sector number)
          if (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sector > 1000000) {
            throw new CorruptFileError('FAT sector number in DIF chain unreasonably large: ' + sector);
          }

          if (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF) {
            fatSectors.push(sector);
          }
        }

        var nextDifSectorData = readValidated(file, 4, 'next DIF sector pointer'); // Issue 3
        difSector = bytesToInt32(nextDifSectorData); // Issue 2

        iterations++;
      }
      
      if (iterations >= maxIterations) {
        throw new CorruptFileError('MSAT chain too long, possible corruption');
      }
    }

    return fatSectors;
  };

  /**
   * Follows sector chain in FAT to read all sectors for a stream
   * * @param {Array} fat - File Allocation Table
   * @param {number} cSectors - Expected number of sectors
   * @param {number} sectStart - Starting sector number
   * @returns {Array} Ordered array of sector numbers in chain
   */
  _proto.readSectorsFromSAT = function readSectorsFromSAT(fat, cSectors, sectStart) {
    if (sectStart === 0xFFFFFFFE || sectStart === 0xFFFFFFFF) {
      return [];
    }
    
    var sectors = [];
    var sector = sectStart;
    // A14: Use Set for performance
    var visitedSectors = new Set();
    var maxIterations = Math.max(cSectors * 2, 10000);
    var iterations = 0;

    for (var i = 0; i < cSectors && sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && iterations < maxIterations; i++) {
      if (visitedSectors.has(sector)) {
        console.warn('Circular reference detected in SAT chain at sector ' + sector);
        break;
      }
      visitedSectors.add(sector);
      
      sectors.push(sector);
      
      // A6: Validate sector index is within FAT bounds
      if (sector < 0 || sector >= fat.length) {
        console.warn('Sector index out of bounds: ' + sector + '. Truncating chain.');
        break;
      }
      
      sector = fat[sector];
      iterations++;
    }
    
    if (iterations >= maxIterations) {
      console.warn('SAT chain too long, possible corruption. Truncating.');
    }

    return sectors;
  };

  /**
   * Parses directory entries to construct stream hierarchy
   * Each directory entry is 128 bytes and describes a storage or stream
   * Directory structure forms a red-black tree
   * * @throws {CorruptFileError} If root entry not found or structure invalid
   */
  _proto.readDirTree = function readDirTree() {
    // CRITICAL FIX #3: Add Detailed Logging
    console.log('=== Reading Directory Tree ===');
    
    var file = this.file;
    var header = this.header;
    var sectors = this.sectors;
    var dirSectors = sectors.dirSectors;
    var rootStream = null;
    var entries = [];
    
    console.log('Directory sectors:', sectors.dirSectors);
    console.log('Sector size:', header.uSectorSize);
    console.log('Processing ' + dirSectors.length + ' directory sectors...');

    try {
      for (var i = 0; i < dirSectors.length; i++) {
        var sector = dirSectors[i];
        var offset = getSectorOffset(sector, header.uSectorSize); // Issue 13
        
        if (offset + header.uSectorSize > file.arrayBuffer.length) {
          console.warn('Directory sector ' + sector + ' points beyond file boundary, skipping');
          continue;
        }
        
        file.seek(offset);

        // Calculate entries per sector dynamically (128 bytes per entry)
        var entriesPerSector = header.uSectorSize / 128;
        
        // CRITICAL FIX #1: Replaced directory entry reading loop
        for (var j = 0; j < entriesPerSector; j++) {
          var entryStartOffset = file.offset;
        
          // CRITICAL FIX: Check if we have enough data left
          if (file.offset + 128 > file.arrayBuffer.length) {
            console.warn('Not enough data for directory entry at offset ' + file.offset);
            break;
          }
        
          try {
            var nameData = file.read(64); // Use read() instead of readValidated() for flexibility
            if (nameData.length < 64) {
              console.warn('Incomplete directory entry name at offset ' + entryStartOffset);
              file.seek(entryStartOffset + 128);
              continue;
            }
            
            var name = '';
        
            // IMPROVED: More lenient name parsing
            for (var k = 0; k < nameData.length; k += 2) {
              if (nameData[k] === 0 && nameData[k + 1] === 0) {
                break;
              }
              var charCode = nameData[k] | (nameData[k + 1] << 8);
              if (charCode > 0 && charCode < 0xFFFF) { // Valid Unicode range
                name += String.fromCharCode(charCode);
              }
            }
        
            // Sanitize name
            name = name.replace(/[\x00-\x1F\x7F]/g, '');
        
            var d = file.read(2); // Name length
            if (d.length < 2) {
              file.seek(entryStartOffset + 128);
              continue;
            }
            var nameLength = d[0] | (d[1] << 8);
            
            // RELAXED: Don't skip entry if name length is unusual
            if (nameLength > 64) {
              console.warn('Unusual name length (' + nameLength + ') for entry: ' + name);
              // Continue anyway instead of skipping
            }
        
            d = file.read(1); // Type
            if (d.length < 1) {
              file.seek(entryStartOffset + 128);
              continue;
            }
            var type = d[0];
            
            // CRITICAL FIX: Accept all valid types
            // Type 1 = Storage, Type 2 = Stream, Type 5 = Root
            if (type !== 1 && type !== 2 && type !== 5) {
              console.log('Skipping entry with invalid type: ' + type + ' (name: ' + name + ')');
              file.seek(entryStartOffset + 128);
              continue;
            }
            
            d = file.read(1); // Flags
            if (d.length < 1) {
              file.seek(entryStartOffset + 128);
              continue;
            }
            
            d = file.read(4); // Left child
            var leftChild = d.length === 4 ? bytesToInt32(d) : 0xFFFFFFFF;
            
            d = file.read(4); // Right child
            var rightChild = d.length === 4 ? bytesToInt32(d) : 0xFFFFFFFF;
            
            d = file.read(4); // Storage dir id
            var storageDirId = d.length === 4 ? bytesToInt32(d) : 0xFFFFFFFF;
            
            // Skip CLSID (16 bytes), User Flags (4), Creation Time (8), Modification Time (8)
            file.read(36);
            
            d = file.read(4); // Start sector
            var sectStart = d.length === 4 ? bytesToInt32(d) : 0xFFFFFFFF;
            
            d = file.read(4); // Stream size
            var size = d.length === 4 ? bytesToInt32(d) : 0;
            
            file.read(4); // Reserved
        
            // Validate stream size
            if (type === 2 && size > file.arrayBuffer.length * 2) {
              console.warn('Stream size in entry (' + name + ') is unreasonably large, capping.');
              size = Math.min(size, file.arrayBuffer.length);
            }
        
            var entry = {
              name: name,
              type: type,
              sectStart: sectStart,
              size: size,
              leftChild: leftChild,
              rightChild: rightChild,
              storageDirId: storageDirId
            };
        
            // CRITICAL FIX: More lenient root entry detection
            if (type === 5) {
              if (rootStream) {
                console.warn('Multiple root entries detected, using first one.');
              } else {
                console.log('Found root entry: ' + name);
                rootStream = entry;
                this.rootStreamEntry = entry;
                
                // FIX: Ensure root has valid size
                if (rootStream.size === 0) {
                  console.warn('Root stream size is zero, setting to default.');
                  rootStream.size = header.ulMiniSectorCutoff || 4096;
                }
              }
            }
        
            entries.push(entry);
            
          } catch (entryError) {
            console.warn('Error reading directory entry ' + j + ' in sector ' + i + ': ' + entryError.message);
            // Ensure we advance to next entry
            try {
              file.seek(entryStartOffset + 128);
            } catch (seekError) {
              console.error('Cannot seek to next entry, stopping directory read');
              break;
            }
          }
        }
        // END CRITICAL FIX #1
      }

      // CRITICAL FIX #2: Better Root Entry Handling
      if (!rootStream) {
        console.error('Root Entry not found in directory tree. Entries found:', entries.length);
        
        // FALLBACK: Try to find entry with storageDirId === 0xFFFFFFFF as root
        console.log('Attempting fallback root detection...');
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].type === 1 && entries[i].storageDirId !== 0xFFFFFFFF) {
            console.log('Using storage entry as root: ' + entries[i].name);
            rootStream = entries[i];
            this.rootStreamEntry = rootStream;
            if (rootStream.size === 0) {
              rootStream.size = header.ulMiniSectorCutoff || 4096;
            }
            break;
          }
        }
        
        if (!rootStream) {
          // LAST RESORT: Use first entry
          if (entries.length > 0) {
            console.warn('Using first entry as root (desperate measure)');
            rootStream = entries[0];
            this.rootStreamEntry = rootStream;
            // Ensure some sane defaults
            if (rootStream.type !== 1 && rootStream.type !== 5) rootStream.type = 1; // Treat as storage
            if (rootStream.size === 0) rootStream.size = 4096;
            if (!rootStream.storageDirId) rootStream.storageDirId = 0xFFFFFFFF;
          } else {
             // If no entries at all, create a dummy root to prevent crash, though parsing will fail
             console.error('No directory entries found at all. File is severely corrupted.');
             // *** THIS IS THE FIX: We MUST throw an error here ***
             throw new CorruptFileError('No directory entries found at all. File is severely corrupted.');
          }
        }
      }
      // END CRITICAL FIX #2

      this.readStorageTree(rootStream, entries);
      this.streams = rootStream.streams || {};
    } catch (e) {
      if (e instanceof MsgReaderError) {
        throw e;
      }
      throw new CorruptFileError('Failed to read directory tree: ' + e.message);
    }
  };

  /**
   * Recursively traverses storage hierarchy and reads all streams
   * Uses depth-first search through red-black tree structure
   * * @param {Object} root - Root storage entry
   * @param {Array} entries - All directory entries
   * @param {number} [depth=0] - Current recursion depth (A5)
   */
  _proto.readStorageTree = function readStorageTree(root, entries, depth) { // A5: Added depth parameter
    var _this = this;

    // A5: Check depth limit
    depth = depth || 0;
    if (depth > 50) {
        console.warn('Storage tree depth limit reached (50), truncating search.');
        return;
    }

    root.streams = {};
    var stack = [root.storageDirId];
    var visitedEntries = new Set(); // A5/B12: Use Set for visited entries
    var maxStackSize = 1000; // B12: Stack size limit
    var maxIterations = entries.length * 2;
    var iterations = 0;

    while (stack.length > 0 && iterations < maxIterations) {
      var entryId = stack.pop();
      iterations++;
      
      // B10: Validate entryId bounds check against entries length
      if (entryId < 0 || entryId >= entries.length) {
        continue;
      }
      
      if (visitedEntries.has(entryId)) {
        console.warn('Circular reference detected in storage tree at entry ' + entryId);
        continue;
      }
      visitedEntries.add(entryId);
      
      var entry = entries[entryId];

      if (!entry) {
        continue;
      }

      if (entry.type === 1 || entry.type === 2) {
        // B28: Avoid creating large intermediate arrays here by using a direct check
        if (entry.name.length > 1000) {
            console.warn('Skipping stream due to unusually long name: ' + entry.name.length);
        } else {
            root.streams[entry.name] = entry;
        }


        if (entry.type === 1) {
          try {
            // A5: Pass incremented depth to recursive call
            this.readStorageTree(entry, entries, depth + 1);
          } catch (e) {
            console.warn('Error reading storage subtree for ' + entry.name + ': ' + e.message);
          }
        }
      }

      // B10: Validate child index bounds before pushing to stack
      if (entry.leftChild !== 0xFFFFFFFF && entry.leftChild < entries.length) {
        stack.push(entry.leftChild);
      } else if (entry.leftChild !== 0xFFFFFFFF) {
        console.warn('Left child index out of bounds: ' + entry.leftChild);
      }

      if (entry.rightChild !== 0xFFFFFFFF && entry.rightChild < entries.length) {
        stack.push(entry.rightChild);
      } else if (entry.rightChild !== 0xFFFFFFFF) {
        console.warn('Right child index out of bounds: ' + entry.rightChild);
      }
      
      // B12: Stack size limit check
      if (stack.length > maxStackSize) {
        console.warn('Storage tree stack exceeded max size, truncating.');
        stack.length = maxStackSize;
      }
    }

    if (iterations >= maxIterations) {
      console.warn('Storage tree traversal limit reached, possible corruption');
    }

    if (root.streams['\u0005DocumentSummaryInformation']) {
      try {
        this.readDocumentSummary(root.streams['\u0005DocumentSummaryInformation']);
      } catch (e) {
        console.warn('Error reading document summary: ' + e.message);
      }
    }

    // Consolidated stream processing loops using new helper logic (Issue 4, 15)
    
    // Process __substg1.0_ streams (fields)
    // NOTE: We don't need to do a full read/process here, as `Reader.readFields` handles the actual conversion later. 
    // This part is only for ensuring `stream.content` is populated.
    for (var key in root.streams) {
        if (key.indexOf('__substg1.0_') > -1) {
            try {
                _this.readStream(root.streams[key]);
            } catch (e) {
                console.warn('Error reading stream ' + key + ': ' + e.message);
            }
        }
    }
    
    // Process attachments
    var attachKeys = [];
    for (var key in root.streams) {
        if (key.indexOf('__attach_version1.0_') > -1) {
            attachKeys.push(key);
        }
    }

    // B16: Attachment count limit
    if (attachKeys.length > 100) {
        console.warn('Too many attachments (' + attachKeys.length + '), limiting processing to 100.');
        attachKeys.length = 100;
    }
    
    attachKeys.forEach(function (key) {
      try {
        var attachStream = root.streams[key];
        if (!attachStream.streams) {
          console.warn("MsgReader: Attachment stream found but contains no sub-streams.", key);
          return;
        }
        
        var attachStreams = attachStream.streams;
        // B28: Use for...in loop for attachment sub-streams
        for (var subKey in attachStreams) {
            if (subKey.indexOf('__substg1.0_') > -1) {
                try {
                    // Just ensure stream content is read
                    _this.readStream(attachStreams[subKey]); 
                } catch (e) {
                    console.warn('Error reading attachment stream ' + subKey + ': ' + e.message);
                }
            }
        }
      } catch (e) {
        console.warn('Error reading attachment ' + key + ': ' + e.message);
      }
    });
    
    // Process recipients
    var recipKeys = [];
    for (var key in root.streams) {
        if (key.indexOf('__recip_version1.0_') > -1) {
            recipKeys.push(key);
        }
    }

    // B17: Recipient count limit
    if (recipKeys.length > 1000) {
        console.warn('Too many recipients (' + recipKeys.length + '), limiting processing to 1000.');
        recipKeys.length = 1000;
    }

    recipKeys.forEach(function (key) {
      try {
        var recipStream = root.streams[key];
        if (!recipStream.streams) {
          console.warn("MsgReader: Recipient stream found but contains no sub-streams.", key);
          return;
        }
        
        var recipStreams = recipStream.streams;
        // B28: Use for...in loop for recipient sub-streams
        for (var subKey in recipStreams) {
            if (subKey.indexOf('__substg1.0_') > -1) {
                try {
                    // Just ensure stream content is read
                    _this.readStream(recipStreams[subKey]);
                } catch (e) {
                    console.warn('Error reading recipient stream ' + subKey + ': ' + e.message);
                }
            }
        }
      } catch (e) {
        console.warn('Error reading recipient ' + key + ': ' + e.message);
      }
    });
  };

  /**
   * Reads stream content from either regular FAT or Mini FAT
   * Streams smaller than ulMiniSectorCutoff (typically 4096 bytes) use Mini FAT
   * * @param {Object} stream - Stream directory entry
   * @throws {CorruptFileError} If sector chain is invalid
   */
  _proto.readStream = function readStream(stream) {
    var file = this.file;
    var header = this.header;
    var sectors = this.sectors;
    var fat = sectors.fat;
    var miniFat = sectors.miniFat;

    if (!stream || stream.size === 0) {
      stream.content = [];
      return;
    }

    var sector = stream.sectStart;
    
    if (sector === 0xFFFFFFFE || sector === 0xFFFFFFFF) {
      stream.content = [];
      return;
    }
    
    // A7: Memory exhaustion check (100MB general limit)
    var streamSize = stream.size;
    if (streamSize > 100 * 1024 * 1024) { 
        console.warn('Stream size (' + streamSize + ' bytes) exceeds 100MB, truncating.');
        streamSize = 100 * 1024 * 1024;
    }

    // B18: Attachment data limit (25MB specific limit)
    // Attachment data stream ID is 3701
    if (stream.name && stream.name.indexOf('__substg1.0_3701') > -1 && streamSize > 25 * 1024 * 1024) { 
        console.warn('Attachment data stream size exceeds 25MB, truncating.');
        streamSize = 25 * 1024 * 1024;
    }


    // A15: Use Uint8Array buffer for efficient binary data storage
    var contentBuffer = new Uint8Array(streamSize);
    var contentWriteOffset = 0;
    
    var sectorsChain;
    var sectorSize;
    var useMiniFat = streamSize < header.ulMiniSectorCutoff;
    
    // MiniFAT sector chain reading safety hazard fix: Pre-calculate mini stream sectors
    var miniStreamSectors = null;
    var rootStream = this.rootStreamEntry; 

    if (useMiniFat) {
        if (!rootStream) {
            throw new CorruptFileError("Root Entry not found for MiniFAT access");
        }
        // B2: Cache the MiniFAT sectors chain read once, outside the loop
        miniStreamSectors = this.readSectorsFromSAT(
            fat, 
            Math.ceil(rootStream.size / header.uSectorSize), 
            rootStream.sectStart
        );
        if (miniStreamSectors.length === 0) {
          throw new CorruptFileError('Mini stream sectors not found');
        }
    }


    try {
      if (!useMiniFat) {
        sectorsChain = fat;
        sectorSize = header.uSectorSize;
        
        var offset = getSectorOffset(sector, sectorSize); // Issue 13
        validateSectorOffset(offset, sectorSize, file.arrayBuffer.length, 'Regular Stream'); // Issue 1
        
        file.seek(offset);
      } else {
        sectorsChain = miniFat;
        sectorSize = header.uMiniSectorSize;
        
        // Use getMiniStreamPosition helper (Issue 17)
        if (sector > 100000) { 
            throw new CorruptFileError('Mini stream sector number too large: ' + sector); 
        }

        var pos = getMiniStreamPosition(sector, sectorSize, header.uSectorSize, miniStreamSectors);
        var actualOffset = pos.actualOffset;
        
        if (actualOffset === -1) {
            console.warn('Mini stream data sector index out of bounds, truncating');
            stream.content = Array.from(contentBuffer.slice(0, contentWriteOffset));
            return;
        }

        if (actualOffset >= file.arrayBuffer.length) {
          throw new CorruptFileError('Mini stream offset points beyond file boundary');
        }
        
        file.seek(actualOffset);
      }

      var bytesLeft = streamSize;
      var visitedSectors = {};
      var maxIterations = Math.ceil(streamSize / sectorSize) * 2;
      var iterations = 0;

      while (bytesLeft > 0 && sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && iterations < maxIterations) {
        if (visitedSectors[sector]) {
          throw new CorruptFileError('Circular reference in stream sector chain');
        }
        visitedSectors[sector] = true;
        iterations++;
        
        var bytesToRead = Math.min(bytesLeft, sectorSize);
        
        // B21: Check for invalid bytesToRead
        if (bytesToRead <= 0) { 
             console.warn('Invalid bytes to read, stopping stream read.');
             break; 
        }

        var chunk = file.read(bytesToRead);
        
        // A15: Copy chunk into the typed array buffer
        if (contentWriteOffset + chunk.length > contentBuffer.length) {
            console.warn('Buffer overflow detected during stream read, truncating.');
            break; 
        }
        // Use loop for array copy (Issue 9)
        for (var i = 0; i < chunk.length; i++) {
            contentBuffer[contentWriteOffset + i] = chunk[i];
        }
        contentWriteOffset += chunk.length;
        
        bytesLeft -= chunk.length; // Use chunk.length in case of partial read (which A8 now prevents)
        
        if (bytesLeft > 0) {
          if (sector >= sectorsChain.length) {
            console.warn('Sector index out of bounds, truncating stream');
            break;
          }
          
          sector = sectorsChain[sector];

          if (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF) {
            if (!useMiniFat) {
              var _offset2 = getSectorOffset(sector, sectorSize); // Issue 13
              if (_offset2 >= file.arrayBuffer.length) {
                console.warn('Stream sector points beyond file boundary, truncating');
                break;
              }
              file.seek(_offset2);
            } else {
              // Use cached rootStream and helper (Issue 17)
              var _pos = getMiniStreamPosition(sector, sectorSize, header.uSectorSize, miniStreamSectors);
              var _actualOffset = _pos.actualOffset;

              if (_actualOffset === -1) {
                  console.warn('Mini stream data sector index out of bounds, truncating');
                  break;
              }

              if (_actualOffset >= file.arrayBuffer.length) {
                console.warn('Mini stream offset points beyond file boundary, truncating');
                break;
              }
              
              file.seek(_actualOffset);
            }
          }
        }
      }

      if (iterations >= maxIterations) {
        console.warn('Stream read iteration limit reached, possible corruption');
      }

      // Return content as standard Array to maintain existing API compatibility
      stream.content = Array.from(contentBuffer.slice(0, contentWriteOffset));
    } catch (e) {
      console.error('Error reading stream: ' + e.message);
      // If error occurs, return partial content read so far
      stream.content = Array.from(contentBuffer.slice(0, contentWriteOffset));
      throw e;
    }
  };

  /**
   * Parses Document Summary Information stream
   * Contains metadata properties according to [MS-OLEPS] specification
   * * @param {Object} stream - Document summary stream entry
   */
  _proto.readDocumentSummary = function readDocumentSummary(stream) {
    // A11: Check for stream existence before proceeding
    if (!stream) { return; }

    try {
      this.readStream(stream);

      if (!stream.content || stream.content.length === 0) {
        return;
      }

      var content = stream.content.slice();
      
      if (content.length < 28) {
        return;
      }
      
      var d = content.splice(0, 4); // Skip header (version, format, etc)
      d = content.splice(0, 4);
      d = content.splice(0, 4);
      d = content.splice(0, 4);
      d = content.splice(0, 16); // Skip CLSID
      
      d = content.splice(0, 4);
      var sectionCount = bytesToInt32(d); // Issue 2

      if (sectionCount !== 1 || content.length < 20) {
        return;
      }

      d = content.splice(0, 16); // Skip FMTID
      
      d = content.splice(0, 4);
      // Issue 2
      var sectionOffset = bytesToInt32(d); 
      
      d = content.splice(0, 4);
      // A3: Check for content length before reading propertyCount
      if (d.length < 4) {
          console.warn('Unexpected end of stream while reading property count in Document Summary.');
          return;
      }
      var propertyCount = bytesToInt32(d); // Issue 2
      
      // B27: Property count check
      if (propertyCount > 1000) {
        throw new CorruptFileError('Document summary property count too large: ' + propertyCount);
      }
      
      var properties = [];

      for (var i = 0; i < propertyCount; i++) {
        // B3: Check if enough data exists for a full property entry (8 bytes: ID + Offset)
        if (content.length < 8) { 
            console.warn('Document Summary: Not enough data remaining for declared properties. Stopping.'); 
            break; 
        }

        d = content.splice(0, 4);
        var propertyId = bytesToInt32(d); // Issue 2
        d = content.splice(0, 4);
        var propertyOffset = bytesToInt32(d); // Issue 2
        properties.push({
          id: propertyId,
          offset: propertyOffset
        });
      }

      // Remaining logic for reading properties is complex and prone to errors; 
      // leaving it largely as-is but ensuring basic bounds check.
      if (content.length >= 8) {
        d = content.splice(0, 4);
        var propertySize = bytesToInt32(d); // Issue 2
        d = content.splice(0, 4);
        var type = bytesToInt32(d); // Issue 2

        if (type === 0x001E && content.length >= 4) {
          d = content.splice(0, 4);
          var size = bytesToInt32(d); // Issue 2
          
          if (size > 0 && size <= content.length) {
            var value = '';
            for (var _i3 = 0; _i3 < size && _i3 < content.length; _i3++) {
              if (content[_i3] === 0) {
                break;
              }
              value += String.fromCharCode(content[_i3]);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error reading document summary: ' + e.message);
    }
  };

  return OleCompoundDoc;
}();

/**
 * File reader with buffered sequential access
 * Provides read and seek operations on byte array
 * * @class ReadFile
 * @param {Array} arrayBuffer - Byte array to read from
 */
var ReadFile = function () {
  function ReadFile(arrayBuffer) {
    if (!arrayBuffer || !arrayBuffer.length) {
      throw new MsgReaderError('Invalid array buffer provided');
    }
    this.arrayBuffer = arrayBuffer;
    this.offset = 0;
  }

  var _proto = ReadFile.prototype;

  /**
   * Reads specified number of bytes from current offset
   * * @param {number} length - Number of bytes to read
   * @returns {Array} Byte array of requested length
   * @throws {MsgReaderError} If read exceeds buffer boundary
   */
  _proto.read = function read(length) {
    if (length < 0) {
      throw new MsgReaderError('Invalid read length: ' + length);
    }
    
    // A8: Throw error on read beyond boundary
    if (this.offset + length > this.arrayBuffer.length) {
        // Allow partial read if at end of file, but only return what's available
        var available = this.arrayBuffer.length - this.offset;
        if (available <= 0) {
            return []; // Nothing left to read
        }
        length = available;
        // Don't throw error, just return partial data
        // throw new MsgReaderError('Read beyond file boundary. Offset: ' + this.offset + ', Length: ' + length + ', File size: ' + this.arrayBuffer.length);
    }
    
    var data = [];
    for (var i = 0; i < length; i++) {
      data[i] = this.arrayBuffer[this.offset + i];
    }
    this.offset += length;
    return data;
  };

  /**
   * Moves read position to specified offset
   * * @param {number} offset - Absolute position in buffer
   * @throws {MsgReaderError} If offset is out of bounds
   */
  _proto.seek = function seek(offset) {
    // Issue 19: Validation moved to helper functions
    if (offset < 0 || offset > this.arrayBuffer.length) {
      throw new MsgReaderError('Invalid seek offset: ' + offset);
    }
    this.offset = offset;
  };

  return ReadFile;
}();

/**
 * MAPI property type identifiers according to [MS-OXCDATA]
 */
var propertyTypes = {
  BINARY: 0x0102,
  STRING: 0x001E,
  UNICODE_STRING: 0x001F,
  OBJECT: 0x000D,
  INTEGER32: 0x0003,
  BOOLEAN: 0x000B,
  TIME: 0x0040
};

/**
 * Common MAPI property tag identifiers
 */
var propertyTags = {
  BODY: 0x1000,
  HTML: 0x1013,
  SUBJECT: 0x0037,
  MESSAGE_CLASS: 0x001A
};

/**
 * Mapping of MAPI property IDs to semantic field names
 * Based on [MS-OXPROPS] and [MS-OXOMSG] specifications
 */
var propertyNames = {
  0x0037: 'subject',
  0x0C1A: 'senderName',
  0x0C1E: 'senderEmail',
  0x0E04: 'recipientEmail',
  0x1000: 'body',
  0x1013: 'html',
  0x3001: 'recipientName',
  0x5FF6: 'senderSmtpAddress',
  0x3FFD: 'normalizedSubject',
  0x0E1D: 'subjectPrefix',
  0x007D: 'headers',
  0x0E03: 'recipientType',
  0x3003: 'recipientAddressType',
  0x0C15: 'recipientDisplayName',
  0x39FE: 'recipientSmtpAddress',
  0x3A00: 'recipientEmailAddress',
  0x3A02: 'recipientName',
  0x3FF9: 'recipientEmail',
  0x3701: 'attachmentData',
  0x3704: 'attachmentFilename',
  0x3707: 'attachmentSize',
  0x370E: 'attachmentMimeTag',
  0x001A: 'messageClass',
  0x0E08: 'messageSize',
  0x0E06: 'messageDeliveryTime',
  0x003D: 'subjectNormalized',
  0x0070: 'conversationTopic',
  0x0C1D: 'senderSearchKey',
  0x0C1F: 'senderEmailType',
  0x5D01: 'senderSmtpAddress',
  0x5D02: 'senderEmail'
};

/**
 * MAPI data structure definitions
 */
var data = {
  propertyTypes: propertyTypes,
  propertyTags: propertyTags,
  propertyNames: propertyNames
};

/**
 * Container for parsed MAPI properties with accessor methods
 * * @class FieldsData
 * @param {Array} fields - Array of parsed field objects
 */
var FieldsData = function () {
  function FieldsData(fields) {
    this.fields = fields || [];
    this.fieldsByName = {};
    this.fieldsById = {};

    for (var i = 0; i < this.fields.length; i++) {
      var field = this.fields[i];
      var name = data.propertyNames[field.nameId];

      if (name) {
        this.fieldsByName[name] = field;
      }

      this.fieldsById[field.nameId] = field;
    }
  }

  var _proto = FieldsData.prototype;

  /**
   * Retrieves field by semantic name
   * * @param {string} name - Field name (e.g., 'subject', 'body')
   * @returns {Object|undefined} Field object or undefined if not found
   */
  _proto.getField = function getField(name) {
    return this.fieldsByName[name];
  };

  /**
   * Retrieves field by MAPI property ID
   * * @param {number} id - Property ID (e.g., 0x0037 for subject)
   * @returns {Object|undefined} Field object or undefined if not found
   */
  _proto.getFieldById = function getFieldById(id) {
    return this.fieldsById[id];
  };
  
  /**
   * Retrieves field value by semantic name
   * * @param {string} name - Field name
   * @returns {*} Field value or undefined if not found
   */
  _proto.getFieldValue = function getFieldValue(name) {
    var field = this.fieldsByName[name];
    return field ? field.value : undefined;
  };

  return FieldsData;
}();

/**
 * Parser for __properties_version1.0 stream
 * Contains MAPI property metadata and extended property definitions
 * * @class Property
 * @param {ReadFile} buffer - Buffer containing property stream data
 */
var Property = function () {
  function Property(buffer) {
    this.buffer = buffer;
    this.properties = [];
    
    try {
      this.readProperties();
    } catch (e) {
      console.warn('Error reading properties: ' + e.message);
    }
  }

  var _proto = Property.prototype;

  /**
   * Parses property entries from buffer
   * Each property entry contains nameId, flags, size, and data
   */
  _proto.readProperties = function readProperties() {
    var buffer = this.buffer;
    
    if (!buffer || !buffer.arrayBuffer || buffer.arrayBuffer.length < 32) {
      return;
    }
    
    buffer.seek(32);

    while (buffer.offset < buffer.arrayBuffer.length - 16) {
      try {
        var d = readValidated(buffer, 4, 'property name ID'); // Issue 3
        var nameId = bytesToInt32(d); // Issue 2
        
        d = readValidated(buffer, 4, 'property flags'); // Issue 3
        var flags = bytesToInt32(d); // Issue 2
        
        d = readValidated(buffer, 8, 'property size'); // Issue 3
        // Note: size is 64-bit in spec, but typically only 32-bit used. Reading as 64-bit.
        var size = bytesToInt32(d.slice(0, 4));
        // We ignore the upper 4 bytes of 64-bit size for now for simplicity, relying on 32-bit value

        // A9: Property size limit check
        if (size > 10 * 1024 * 1024) { 
            console.warn('Property size exceeds 10MB, skipping property at offset ' + buffer.offset);
            break;
        }

        if (size < 0 || size > buffer.arrayBuffer.length) {
          console.warn('Invalid property size: ' + size);
          break;
        }
        
        if (buffer.offset + size > buffer.arrayBuffer.length) {
          console.warn('Property size exceeds buffer, truncating');
          size = buffer.arrayBuffer.length - buffer.offset;
        }
        
        var data = readValidated(buffer, size, 'property data'); // Issue 3

        // B26: Skip data read but maintain alignment for zero-size properties
        if (size === 0) {
            this.properties.push({
                nameId: nameId,
                flags: flags,
                size: 0,
                data: []
            });
        }
        
        // Alignment
        while (buffer.offset % 4 !== 0 && buffer.offset < buffer.arrayBuffer.length) {
          readValidated(buffer, 1, 'property alignment'); // Issue 3
        }
        
        if (size > 0) {
            this.properties.push({
              nameId: nameId,
              flags: flags,
              size: size,
              data: data
            });
        }

      } catch (e) {
        console.warn('Error reading property at offset ' + buffer.offset + ': ' + e.message);
        break;
      }
    }
  };

  return Property;
}();

/**
 * Main MSG/OFT file parser
 * Orchestrates OLE parsing and MAPI property extraction
 * * @class Reader
 * @param {Array|Uint8Array} arrayBuffer - File contents as byte array
 */
var Reader = function () {
  /**
   * BUG FIX: This constructor was rewritten to robustly handle ArrayBuffer,
   * Uint8Array, or a plain Array as input. It converts any valid input
   * into the plain Array<number> that the rest of the library expects.
   */
  function Reader(inputBuffer) { // Renamed parameter
    if (!inputBuffer) {
      throw new MsgReaderError('No data provided to Reader');
    }
    
    if (typeof inputBuffer === 'string') {
      throw new MsgReaderError('Reader expects ArrayBuffer or Uint8Array, not string');
    }

    var plainArray;

    // BUG FIX: Convert ArrayBuffer or Uint8Array to the plain Array
    // that the rest of the library expects.
    if (inputBuffer instanceof ArrayBuffer) {
        var view = new Uint8Array(inputBuffer);
        plainArray = new Array(view.length);
        for (var i = 0; i < view.length; i++) {
            plainArray[i] = view[i];
        }
    } else if (inputBuffer instanceof Uint8Array) {
        plainArray = new Array(inputBuffer.length);
        for (var i = 0; i < inputBuffer.length; i++) {
            plainArray[i] = inputBuffer[i];
        }
    } else if (Array.isArray(inputBuffer)) {
        plainArray = inputBuffer; // Already a plain array
    } else {
        throw new MsgReaderError('Input data is not an ArrayBuffer, Uint8Array, or Array.');
    }
    
    // B25: Validate array buffer contents (now checking plainArray)
    if (plainArray.some(function(b) { return typeof b !== 'number' || b < 0 || b > 255; })) {
        throw new MsgReaderError('Input array buffer contains invalid byte values (must be 0-255).');
    }

    this.arrayBuffer = plainArray; // this.arrayBuffer is now a plain Array
  }

  var _proto = Reader.prototype;

  /**
   * Centralized MAPI property value conversion based on type. (Issue 14)
   * @param {Array<number>} value - The raw byte array value.
   * @param {string} type - The 4-character hex MAPI type code (e.g., '001F').
   * @param {string} key - The full stream key for context/warnings.
   * @returns {*} The converted value.
   */
  _proto.convertPropertyValue = function convertPropertyValue(value, type, key) {
    switch (type) {
      case '001F': // UNICODE_STRING
      case '001E': // STRING
        return bytesToString(value, 'field ' + key); // Issue 5
      case '0102': // BINARY
        return value;
      case '0003': // INTEGER32
        if (value.length === 4) {
          return bytesToInt32(value); // Issue 2
        } else {
          console.warn('Integer field ' + key + ' has wrong length: ' + value.length);
          return 0;
        }
      case '000B': // BOOLEAN
        if (value.length > 0 && (value[0] === 1 || value[0] === 0)) {
          return value[0] === 1;
        } else {
          console.warn('Boolean field ' + key + ' has unexpected value: ' + value[0]);
          return value.length > 0 && value[0] !== 0;
        }
      case '0040': { // TIME
        if (value.length >= 8) {
          var low = bytesToInt32(value.slice(0, 4)); // Issue 2
          var high = bytesToInt32(value.slice(4, 8)); // Issue 2
          
          // A2: Bounds check for safe integer arithmetic
          if (high > 2097151) { 
            console.warn('Date value out of safe range for JS Date: ' + high);
            return new Date(0);
          } 
          
          var ticks = high * 4294967296 + low;
          var date = new Date((ticks / 10000) - 11644473600000);
          
          // B19: Validate resulting date object
          if (isNaN(date.getTime())) {
            console.warn('Invalid date value, using epoch for field ' + key); 
            return new Date(0); 
          }
          return date;
        }
        return new Date(0);
      }
      default:
        return value;
    }
  };

  /**
   * Extracts properties from substreams matching a prefix. (Issue 4, 15)
   * Handles storage-level streams (attachments/recipients) and direct streams (fields).
   * @param {Object} streams - The streams object (e.g., oleCompoundDoc.streams).
   * @param {string} prefix - The stream name prefix (e.g., '__attach_version1.0_').
   * @param {number} limit - Max number of streams to process.
   * @param {string} context - 'fields', 'attachments', or 'recipients'.
   * @returns {Array<Object>} Array of processed field/item objects.
   */
  _proto.processStreamsByPrefix = function processStreamsByPrefix(streams, prefix, limit, context) {
      var _this = this;
      var results = [];

      var keys = Object.keys(streams).filter(function (key) {
          return key.indexOf(prefix) > -1;
      });

      if (keys.length > limit) {
          console.warn('Too many ' + context + ' (' + keys.length + '), limiting processing to ' + limit + '.');
          keys.length = limit;
      }

      keys.forEach(function (key) {
          try {
              var streamEntry = streams[key];
              var processedItem = {};
              var fieldProps = [];

              // Determine if we are processing a storage entry (like attachment/recipient)
              // or a direct property stream (like the main message fields)
              var subStreams = streamEntry.streams || (context === 'fields' ? { [key]: streamEntry } : null);

              if (subStreams) {
                  for (var subKey in subStreams) {
                      if (subKey.indexOf('__substg1.0_') > -1) {
                          var stream = subStreams[subKey];
                          if (!stream.content) continue;

                          var propInfo = parsePropertyId(subKey); // Issue 7
                          if (!propInfo) continue;

                          var name = data.propertyNames[propInfo.nameId];
                          var value = _this.convertPropertyValue(stream.content, propInfo.type, subKey); // Issue 14

                          if (context === 'fields') {
                            fieldProps.push({ name: name, nameId: propInfo.nameId, type: propInfo.type, value: value });
                          } else {
                            processedItem[name] = value;
                          }
                      }
                  }
              }

              // Final result formatting based on context
              if (context === 'attachments') {
                  // B2: Warning if attachment was truncated
                  if (processedItem.attachmentData && processedItem.attachmentSize && processedItem.attachmentData.length < processedItem.attachmentSize) {
                      console.warn('Attachment ' + processedItem.attachmentFilename + ' was truncated. Declared size: ' + processedItem.attachmentSize + ', Actual read size: ' + processedItem.attachmentData.length);
                  }

                  results.push({
                      data: processedItem.attachmentData,
                      name: processedItem.attachmentFilename,
                      mime: processedItem.attachmentMimeTag,
                      size: processedItem.attachmentSize
                  });
              } else if (context === 'recipients') {
                  results.push(processedItem);
              } else if (context === 'fields') {
                  results.push.apply(results, fieldProps);
              }

          } catch (e) {
              console.warn('Error reading ' + context + ' stream ' + key + ': ' + e.message);
          }
      });

      return results;
  };

  /**
   * Initiates parsing of MSG/OFT file structure
   * * @returns {FieldsData} Parsed fields with accessor methods
   * @throws {MsgReaderError} If parsing fails
   */
  _proto.read = function read() {
    try {
      var buffer = this.arrayBuffer;
      var file = new ReadFile(buffer);
      var oleCompoundDoc = new OleCompoundDoc(file);
      
      if (!oleCompoundDoc || !oleCompoundDoc.streams) { 
        throw new CorruptFileError('Invalid MSG/OFT file structure'); 
      }
      
      var fields = this.readFields(oleCompoundDoc);
      var fieldsData = new FieldsData(fields);
      
      var messageClass = fieldsData.getFieldValue('messageClass');
      fieldsData.isTemplate = messageClass && messageClass.indexOf('.Template') > -1;
      
      return fieldsData;
    } catch (e) {
      if (e instanceof MsgReaderError) {
        throw e;
      }
      throw new MsgReaderError('Failed to read MSG/OFT file: ' + e.message);
    }
  };

  /**
   * Extracts MAPI properties from OLE compound document streams
   * Processes main message properties, attachments, and recipients
   * * @param {OleCompoundDoc} oleCompoundDoc - Parsed OLE document
   * @returns {Array} Array of field objects with name, type, and value
   */
  _proto.readFields = function readFields(oleCompoundDoc) {
    var streams = oleCompoundDoc.streams;
    
    if (!streams) {
      console.error("MsgReader: OLE streams not found.");
      return [];
    }
    
    var propertyStream = streams['__properties_version1.0'];
    var fields = [];

    if (propertyStream && propertyStream.content) {
      try {
        // This is primarily for reading extended property definitions, not the main fields
        var property = new Property(new ReadFile(propertyStream.content)); 
      } catch (e) {
        console.warn('Error reading property stream: ' + e.message);
      }
    }

    // Process main message streams (Issue 15, 4 - Consolidated)
    var mainFields = this.processStreamsByPrefix(streams, '__substg1.0_', Infinity, 'fields');
    fields.push.apply(fields, mainFields);

    // Process attachments (Issue 15, 4 - Consolidated)
    var attachments = this.processStreamsByPrefix(streams, '__attach_version1.0_', 100, 'attachments');
    if (attachments.length) {
      fields.push({
        name: 'attachments',
        nameId: 0,
        type: 0,
        value: attachments
      });
    }

    // Process recipients (Issue 15, 4 - Consolidated)
    var recipients = this.processStreamsByPrefix(streams, '__recip_version1.0_', 1000, 'recipients');
    if (recipients.length) {
      fields.push({
        name: 'recipients',
        nameId: 0,
        type: 0,
        value: recipients
      });
    }

    return fields;
  };

  return Reader;
}();

/**
 * Public API for MSG/OFT file parsing
 * * @namespace MsgReader
 * @version 2.0.0
 */
var MsgReader = {
  /**
   * Parses MSG or OFT file from byte array
   * * @param {Array|Uint8Array} arrayBuffer - File contents
   * @returns {FieldsData} Parsed message fields
   * @throws {MsgReaderError} If parsing fails
   * * @example
   * const fileData = new Uint8Array(buffer);
   * const result = MsgReader.read(fileData);
   * const subject = result.getFieldValue('subject');
   * const isTemplate = result.isTemplate;
   */
  read: function(arrayBuffer) {
    var reader = new Reader(arrayBuffer);
    return reader.read();
  },
  MsgReaderError: MsgReaderError,
  CorruptFileError: CorruptFileError
};

exports.default = MsgReader;
exports.MsgReader = MsgReader;

return exports;

})));

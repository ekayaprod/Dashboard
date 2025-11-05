/**
 * msgreader.js v2.0.0
 * * Microsoft Outlook MSG and OFT file parser for JavaScript environments.
 * Implements OLE Compound File Binary Format (CFB) parsing according to
 * [MS-CFB] and [MS-OXMSG] specifications.
 * * Original Author: B-AR (https://github.com/B-AR)
 * Enhanced Version: Includes comprehensive error handling, validation,
 * OFT template support, and memory optimization.
 * * Supported Formats:
 * - .msg (Microsoft Outlook Message Files)
 * - .oft (Microsoft Outlook Template Files)
 * * @version 2.0.0
 * @license MIT
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
    
    var d = file.read(HEADER_SIGNATURE_SIZE);
    // A3: Check if read was complete
    if (d.length < HEADER_SIGNATURE_SIZE) throw new CorruptFileError('Unexpected end of file in header signature.');

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

    d = file.read(HEADER_CLSID_SIZE); // Skip CLSID
    if (d.length < HEADER_CLSID_SIZE) throw new CorruptFileError('Unexpected end of file in header CLSID.');

    d = file.read(USHORT_SIZE);
    if (d.length < USHORT_SIZE) throw new CorruptFileError('Unexpected end of file in header minor version.');
    header.uMinorVersion = d[0];

    d = file.read(USHORT_SIZE);
    if (d.length < USHORT_SIZE) throw new CorruptFileError('Unexpected end of file in header major version.');
    header.uMajorVersion = d[0];
    
    if (header.uMajorVersion !== 3 && header.uMajorVersion !== 4) {
      throw new CorruptFileError('Unsupported OLE version: ' + header.uMajorVersion);
    }
    
    d = file.read(USHORT_SIZE);
    if (d.length < USHORT_SIZE) throw new CorruptFileError('Unexpected end of file in header byte order.');
    header.uByteOrder = d[0];
    
    if (header.uByteOrder !== 0xFFFE) {
      throw new CorruptFileError('Invalid byte order marker');
    }
    
    d = file.read(USHORT_SIZE);
    if (d.length < USHORT_SIZE) throw new CorruptFileError('Unexpected end of file in header sector shift.');
    header.uSectorShift = d[0];
    
    // B1: Restrict sector shift to standard 512/4096 bytes (9 or 12)
    if (header.uSectorShift !== 9 && header.uSectorShift !== 12) {
      throw new CorruptFileError('Invalid sector shift: ' + header.uSectorShift + '. Must be 9 (512 bytes) or 12 (4096 bytes)');
    }
    
    header.uSectorSize = 1 << header.uSectorShift;
    
    d = file.read(USHORT_SIZE);
    if (d.length < USHORT_SIZE) throw new CorruptFileError('Unexpected end of file in header mini sector shift.');
    header.uMiniSectorShift = d[0];
    
    if (header.uMiniSectorShift < 6 || header.uMiniSectorShift > header.uSectorShift) {
      throw new CorruptFileError('Invalid mini sector shift: ' + header.uMiniSectorShift);
    }
    
    header.uMiniSectorSize = 1 << header.uMiniSectorShift;
    d = file.read(6); // Skip reserved
    if (d.length < 6) throw new CorruptFileError('Unexpected end of file in header reserved section.');

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header cDirSectors.');
    header.cDirSectors = d[0];
    
    // B7: Directory sector count validation
    if (header.cDirSectors > 1000) {
      throw new CorruptFileError('Directory sector count unreasonably large: ' + header.cDirSectors);
    }

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header cFATSectors.');
    header.cFATSectors = d[0];
    
    // B5: FAT sector count validation
    if (header.cFATSectors > 10000) {
      throw new CorruptFileError('FAT sector count unreasonably large: ' + header.cFATSectors);
    }

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header sectDirStart.');
    header.sectDirStart = d[0];

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header signature (2).');
    header.signature = d[0];

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header ulMiniSectorCutoff.');
    header.ulMiniSectorCutoff = d[0];
    
    // B2: Mini sector cutoff validation
    if (header.ulMiniSectorCutoff === 0) {
      header.ulMiniSectorCutoff = 4096;
    } else if (header.ulMiniSectorCutoff < 512 || header.ulMiniSectorCutoff > 65536) {
        throw new CorruptFileError('Mini sector cutoff out of valid range: ' + header.ulMiniSectorCutoff);
    }

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header sectMiniFatStart.');
    header.sectMiniFatStart = d[0];

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header cMiniFatSectors.');
    header.cMiniFatSectors = d[0];

    // B6: Mini FAT sector count validation
    if (header.cMiniFatSectors > 10000) {
      throw new CorruptFileError('Mini FAT sector count unreasonably large: ' + header.cMiniFatSectors);
    }

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header sectDifStart.');
    header.sectDifStart = d[0];

    d = file.read(ULONG_SIZE);
    if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header cDifSectors.');
    header.cDifSectors = d[0];
    
    var difSectors = [];
    for (var _i = 0; _i < 109; _i++) {
      d = file.read(ULONG_SIZE);
      if (d.length < ULONG_SIZE) throw new CorruptFileError('Unexpected end of file in header MSAT.');
      
      // B3: Basic MSAT sanity check (0xFFFFFFFF is -1 in 32-bit signed, but we check for large values)
      if (d[0] !== 0xFFFFFFFE && d[0] !== 0xFFFFFFFF && d[0] > (file.arrayBuffer.length / header.uSectorSize) * 2) {
        throw new CorruptFileError('MSAT entry points to unreasonably large sector: ' + d[0]);
      }
      difSectors[_i] = d[0];
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
        
        var offset = 512 + sector * sectorSize;
        if (offset + sectorSize > file.arrayBuffer.length) {
          throw new CorruptFileError('FAT sector ' + sector + ' points beyond file boundary');
        }
        
        file.seek(offset);
        for (var j = 0; j < sectorsInFat; j++) {
          var entry = file.read(4);
          if (entry.length < 4) throw new CorruptFileError('Unexpected end of file while reading FAT entries.');
          fat.push(entry[0] | (entry[1] << 8) | (entry[2] << 16) | (entry[3] << 24));
        }
      }

      var miniFatSectors = this.readSectorsFromSAT(fat, header.cMiniFatSectors, header.sectMiniFatStart);
      var miniFat = [];

      for (var _i2 = 0; _i2 < miniFatSectors.length; _i2++) {
        var _sector = miniFatSectors[_i2];
        var _offset = 512 + _sector * sectorSize;
        if (_offset + sectorSize > file.arrayBuffer.length) {
          console.warn('Mini FAT sector ' + _sector + ' points beyond file boundary, skipping');
          continue;
        }
        
        file.seek(_offset);
        for (var _j = 0; _j < sectorsInFat; _j++) {
          var entry = file.read(4);
          if (entry.length < 4) throw new CorruptFileError('Unexpected end of file while reading Mini FAT entries.');
          miniFat.push(entry[0] | (entry[1] << 8) | (entry[2] << 16) | (entry[3] << 24));
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
        
        var offset = 512 + difSector * sectorSize;
        if (offset + sectorSize > file.arrayBuffer.length) {
          throw new CorruptFileError('DIF sector points beyond file boundary');
        }
        
        file.seek(offset);

        for (var j = 0; j < sectorsInFat - 1; j++) {
          var sectorData = file.read(4);
          if (sectorData.length < 4) throw new CorruptFileError('Unexpected end of file while reading DIF sector entries.');

          var sector = sectorData[0] | (sectorData[1] << 8) | (sectorData[2] << 16) | (sectorData[3] << 24);
          
          // B4: Sanity check DIF sector entry (sector number)
          if (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && sector > 1000000) {
            throw new CorruptFileError('FAT sector number in DIF chain unreasonably large: ' + sector);
          }

          if (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF) {
            fatSectors.push(sector);
          }
        }

        var nextDifSectorData = file.read(4);
        if (nextDifSectorData.length < 4) throw new CorruptFileError('Unexpected end of file while reading next DIF sector pointer.');
        difSector = nextDifSectorData[0] | (nextDifSectorData[1] << 8) | (nextDifSectorData[2] << 16) | (nextDifSectorData[3] << 24);

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
    var file = this.file;
    var header = this.header;
    var sectors = this.sectors;
    var dirSectors = sectors.dirSectors;
    var rootStream = null;
    var entries = [];

    try {
      for (var i = 0; i < dirSectors.length; i++) {
        var sector = dirSectors[i];
        var offset = 512 + sector * header.uSectorSize;
        
        if (offset + header.uSectorSize > file.arrayBuffer.length) {
          console.warn('Directory sector ' + sector + ' points beyond file boundary, skipping');
          continue;
        }
        
        file.seek(offset);

        // 4 entries per sector (128 bytes each)
        for (var j = 0; j < 4; j++) {
          var entryStartOffset = file.offset;

          try {
            var nameData = file.read(64);
            var name = '';

            for (var k = 0; k < nameData.length; k += 2) {
              if (nameData[k] === 0 && nameData[k + 1] === 0) {
                break;
              }
              var charCode = nameData[k] | (nameData[k + 1] << 8);
              if (charCode > 0) {
                name += String.fromCharCode(charCode);
              }
            }

            // B24: Sanitize name (remove control characters)
            name = name.replace(/[\x00-\x1F\x7F]/g, '');

            var d = file.read(2);
            var nameLength = d[0] | (d[1] << 8);
            
            // B8: Skip empty or unreasonably long entries
            if (nameLength === 0 || nameLength > 64) {
              file.seek(entryStartOffset + 128);
              continue;
            }

            d = file.read(1);
            var type = d[0];
            
            // B9: Skip reserved or invalid directory entry types
            if (type !== 1 && type !== 2 && type !== 5) {
              file.seek(entryStartOffset + 128);
              continue;
            }
            
            d = file.read(1); // Flags
            
            d = file.read(4);
            var leftChild = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            d = file.read(4);
            var rightChild = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            d = file.read(4);
            var storageDirId = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            d = file.read(16); // CLSID
            d = file.read(4); // User Flags
            d = file.read(8); // Creation Time
            d = file.read(8); // Modification Time
            
            d = file.read(4);
            var sectStart = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            d = file.read(4);
            var size = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            d = file.read(4); // Reserved

            // B11: Validate stream size against file size
            if (type === 2 && size > file.arrayBuffer.length * 2) { // 2x margin for MiniFAT overhead
                console.warn('Stream size in entry (' + name + ') is unreasonably large, capping.');
                size = file.arrayBuffer.length;
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

            if (type === 5) {
              // B29: Ensure only one root entry is processed
              if (rootStream) {
                 throw new CorruptFileError('Multiple root entries detected in directory tree.');
              }
              rootStream = entry;
              this.rootStreamEntry = entry;
            }

            entries.push(entry);
          } catch (entryError) {
            console.warn('Error reading directory entry ' + j + ' in sector ' + i + ': ' + entryError.message);
            // Must advance file pointer to next entry boundary
            file.seek(entryStartOffset + 128);
          }
        }
      }

      if (!rootStream) {
        throw new CorruptFileError('Root Entry not found in directory tree');
      }

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

    // Process __substg1.0_ streams
    // B28: Use for...in loop for efficiency instead of Object.keys().filter()
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
    
    // 2. MiniFAT sector chain reading safety hazard fix: Pre-calculate mini stream sectors
    var miniStreamSectors = null;
    var rootStream = this.rootStreamEntry; 

    if (useMiniFat) {
        if (!rootStream) {
            throw new CorruptFileError("Root Entry not found for MiniFAT access");
        }
        // Cache the MiniFAT sectors chain read once, outside the loop
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
        
        var offset = 512 + sector * sectorSize;
        if (offset >= file.arrayBuffer.length) {
          throw new CorruptFileError('Stream sector points beyond file boundary');
        }
        
        file.seek(offset);
      } else {
        sectorsChain = miniFat;
        sectorSize = header.uMiniSectorSize;
        
        // Use cached miniStreamSectors and rootStream

        // B20: Validate sector index for mini stream
        if (sector > 100000) { 
            throw new CorruptFileError('Mini stream sector number too large: ' + sector); 
        }

        var sectorInMiniStream = Math.floor(sector * sectorSize / header.uSectorSize);
        var offsetInMiniStream = (sector * sectorSize) % header.uSectorSize;
        
        if (sectorInMiniStream >= miniStreamSectors.length) {
          throw new CorruptFileError('Mini stream sector index out of bounds');
        }
        
        // B30: Validate offsetInMiniStream against sector size
        if (offsetInMiniStream >= header.uSectorSize) {
            throw new CorruptFileError('Mini stream offset calculation error');
        }

        var actualOffset = 512 + miniStreamSectors[sectorInMiniStream] * header.uSectorSize + offsetInMiniStream;
        
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
              var _offset2 = 512 + sector * sectorSize;
              if (_offset2 >= file.arrayBuffer.length) {
                console.warn('Stream sector points beyond file boundary, truncating');
                break;
              }
              file.seek(_offset2);
            } else {
              // Use cached rootStream
              
              var _sectorInMiniStream = Math.floor(sector * sectorSize / header.uSectorSize);
              var _offsetInMiniStream = (sector * sectorSize) % header.uSectorSize;
              
              if (_sectorInMiniStream >= miniStreamSectors.length) { // Use cached miniStreamSectors
                console.warn('Mini stream sector index out of bounds, truncating');
                break;
              }
              
              var _actualOffset = 512 + miniStreamSectors[_sectorInMiniStream] * header.uSectorSize + _offsetInMiniStream; // Use cached miniStreamSectors
              
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
      var sectionCount = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);

      if (sectionCount !== 1 || content.length < 20) {
        return;
      }

      d = content.splice(0, 16); // Skip FMTID
      
      d = content.splice(0, 4);
      var sectionOffset = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
      
      d = content.splice(0, 4);
      // A3: Check for content length before reading propertyCount
      if (d.length < 4) {
          console.warn('Unexpected end of stream while reading property count in Document Summary.');
          return;
      }
      var propertyCount = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
      
      // B27: Property count check
      if (propertyCount > 1000) {
        throw new CorruptFileError('Document summary property count too large: ' + propertyCount);
      }
      
      var properties = [];

      for (var i = 0; i < propertyCount && content.length >= 8; i++) {
        d = content.splice(0, 4);
        var propertyId = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
        d = content.splice(0, 4);
        var propertyOffset = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
        properties.push({
          id: propertyId,
          offset: propertyOffset
        });
      }

      // Remaining logic for reading properties is complex and prone to errors; 
      // leaving it largely as-is but ensuring basic bounds check.
      if (content.length >= 8) {
        d = content.splice(0, 4);
        var propertySize = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
        d = content.splice(0, 4);
        var type = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);

        if (type === 0x001E && content.length >= 4) {
          d = content.splice(0, 4);
          var size = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
          
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
      throw new MsgReaderError('Read beyond file boundary. Offset: ' + this.offset + ', Length: ' + length + ', File size: ' + this.arrayBuffer.length);
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
        var d = buffer.read(4);
        var nameId = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
        
        d = buffer.read(4);
        var flags = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
        
        d = buffer.read(8);
        var size = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
        
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
        
        var data = buffer.read(size);

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
          buffer.read(1);
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
  function Reader(arrayBuffer) {
    if (!arrayBuffer) {
      throw new MsgReaderError('No data provided to Reader');
    }
    
    if (typeof arrayBuffer === 'string') {
      throw new MsgReaderError('Reader expects ArrayBuffer or Uint8Array, not string');
    }
    
    if (arrayBuffer instanceof Uint8Array) {
      var arr = new Array(arrayBuffer.length);
      for (var i = 0; i < arrayBuffer.length; i++) {
        arr[i] = arrayBuffer[i];
      }
      arrayBuffer = arr;
    }
    
    // B25: Validate array buffer contents
    if (arrayBuffer.some(function(b) { return typeof b !== 'number' || b < 0 || b > 255; })) {
        throw new MsgReaderError('Input array buffer contains invalid byte values (must be 0-255).');
    }

    this.arrayBuffer = arrayBuffer;
  }

  var _proto = Reader.prototype;

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
    var attachments = [];
    var recipients = [];

    if (propertyStream && propertyStream.content) {
      try {
        var property = new Property(new ReadFile(propertyStream.content));
      } catch (e) {
        console.warn('Error reading property stream: ' + e.message);
      }
    }

    // Process main message streams
    for (var key in streams) {
        if (key.indexOf('__substg1.0_') > -1) {
            try {
                var stream = streams[key];
                if (!stream.content) {
                    continue;
                }
                
                var type = key.substring(key.length - 4, key.length);
                var nameIdStr = key.substring('__substg1.0_'.length, key.length - 4);
                var nameId = parseInt(nameIdStr, 16);
                
                // B14: Check for NaN immediately
                if (isNaN(nameId)) {
                    continue;
                }
                
                var name = data.propertyNames[nameId];
                var value = stream.content;

                if (type === '001F' || type === '001E') {
                    // B15: String conversion with safety check
                    try {
                        value = String.fromCharCode.apply(String, _toConsumableArray(value.filter(function (v) {
                            return v !== 0;
                        })));
                    } catch (e) {
                        console.warn('Invalid string encoding in field ' + key + ': ' + e.message);
                        value = ''; // Use empty string on failure
                    }
                } else if (type === '0102') { // BINARY
                    value = value;
                } else if (type === '0003') { // INTEGER32
                    // B22: Require exactly 4 bytes
                    if (value.length === 4) {
                        value = value[0] | (value[1] << 8) | (value[2] << 16) | (value[3] << 24);
                    } else {
                        console.warn('Integer field ' + key + ' has wrong length: ' + value.length);
                        value = 0;
                    }
                } else if (type === '000B') { // BOOLEAN
                    // B23: Accept only 0 or 1/0xFF as standard boolean
                    if (value.length > 0 && (value[0] === 1 || value[0] === 0)) {
                        value = value[0] === 1;
                    } else {
                        console.warn('Boolean field ' + key + ' has unexpected value: ' + value[0]);
                        value = value.length > 0 && value[0] !== 0; // Fallback to original logic if we must
                    }
                } else if (type === '0040') { // TIME
                    if (value.length >= 8) {
                        var low = value[0] | (value[1] << 8) | (value[2] << 16) | (value[3] << 24);
                        var high = value[4] | (value[5] << 8) | (value[6] << 16) | (value[7] << 24);
                        
                        // A2: Bounds check for safe integer arithmetic
                        if (high > 2097151) { // MAX_SAFE_INTEGER / 2^32 approx
                            console.warn('Date value out of safe range for JS Date: ' + high);
                            value = new Date(0);
                        } else {
                            var ticks = high * 4294967296 + low;
                            value = new Date((ticks / 10000) - 11644473600000);
                        }

                        // B19: Validate resulting date object
                        if (isNaN(value.getTime())) {
                            console.warn('Invalid date value, using epoch for field ' + key); 
                            value = new Date(0); 
                        }
                    }
                }

                fields.push({
                    name: name,
                    nameId: nameId,
                    type: type,
                    value: value
                });
            } catch (e) {
                console.warn('Error reading field ' + key + ': ' + e.message);
            }
        }
    }
    
    // Process attachments
    var attachKeys = Object.keys(streams).filter(function (key) {
        return key.indexOf('__attach_version1.0_') > -1;
    });

    // B16: Enforce attachment limit
    if (attachKeys.length > 100) {
        console.warn('Too many attachments (' + attachKeys.length + '), limiting processing to 100.');
        attachKeys.length = 100;
    }

    attachKeys.forEach(function (key, index) {
      try {
        var attachStream = streams[key];
        if (!attachStream.streams) {
          console.warn("MsgReader: Attachment stream found but contains no sub-streams.", key);
          return;
        }
        
        var attachStreams = attachStream.streams;
        var attachment = {};
        
        // B28: Use for...in loop for attachment sub-streams
        for (var subKey in attachStreams) {
            if (subKey.indexOf('__substg1.0_') > -1) {
                try {
                    var stream = attachStreams[subKey];
                    if (!stream.content) {
                        continue;
                    }
                    
                    var type = subKey.substring(subKey.length - 4, subKey.length);
                    var nameIdStr = subKey.substring('__substg1.0_'.length, subKey.length - 4);
                    var nameId = parseInt(nameIdStr, 16);
                    
                    if (isNaN(nameId)) {
                        continue;
                    }
                    
                    var name = data.propertyNames[nameId];
                    var value = stream.content;

                    if (type === '001F' || type === '001E') {
                         // B15: String conversion with safety check
                        try {
                            value = String.fromCharCode.apply(String, _toConsumableArray(value.filter(function (v) {
                                return v !== 0;
                            })));
                        } catch (e) {
                            console.warn('Invalid string encoding in attachment field ' + subKey + ': ' + e.message);
                            value = '';
                        }
                    } else if (type === '0003') {
                        // B22: Require exactly 4 bytes
                        if (value.length === 4) {
                            value = value[0] | (value[1] << 8) | (value[2] << 16) | (value[3] << 24);
                        } else {
                            console.warn('Integer attachment field ' + subKey + ' has wrong length: ' + value.length);
                            value = 0;
                        }
                    }

                    attachment[name] = value;
                } catch (e) {
                    console.warn('Error reading attachment field ' + subKey + ': ' + e.message);
                }
            }
        }
        
        attachments.push({
          data: attachment.attachmentData,
          name: attachment.attachmentFilename,
          mime: attachment.attachmentMimeTag,
          size: attachment.attachmentSize
        });
      } catch (e) {
        console.warn('Error reading attachment ' + key + ': ' + e.message);
      }
    });

    if (attachments.length) {
      fields.push({
        name: 'attachments',
        nameId: 0,
        type: 0,
        value: attachments
      });
    }

    // Process recipients
    var recipKeys = Object.keys(streams).filter(function (key) {
      return key.indexOf('__recip_version1.0_') > -1;
    });

    // B17: Enforce recipient limit
    if (recipKeys.length > 1000) {
        console.warn('Too many recipients (' + recipKeys.length + '), limiting processing to 1000.');
        recipKeys.length = 1000;
    }

    recipKeys.forEach(function (key, index) {
      try {
        var recipStream = streams[key];
        if (!recipStream.streams) {
          console.warn("MsgReader: Recipient stream found but contains no sub-streams.", key);
          return;
        }
        
        var recipStreams = recipStream.streams;
        var recipient = {};
        
        // B28: Use for...in loop for recipient sub-streams
        for (var subKey in recipStreams) {
            if (subKey.indexOf('__substg1.0_') > -1) {
                try {
                    var stream = recipStreams[subKey];
                    if (!stream.content) {
                        continue;
                    }
                    
                    var type = subKey.substring(subKey.length - 4, subKey.length);
                    var nameIdStr = subKey.substring('__substg1.0_'.length, subKey.length - 4);
                    var nameId = parseInt(nameIdStr, 16);
                    
                    if (isNaN(nameId)) {
                        continue;
                    }
                    
                    var name = data.propertyNames[nameId];
                    var value = stream.content;

                    if (type === '001F' || type === '001E') {
                        // B15: String conversion with safety check
                        try {
                            value = String.fromCharCode.apply(String, _toConsumableArray(value.filter(function (v) {
                                return v !== 0;
                            })));
                        } catch (e) {
                            console.warn('Invalid string encoding in recipient field ' + subKey + ': ' + e.message);
                            value = '';
                        }
                    } else if (type === '0003') {
                        // B22: Require exactly 4 bytes
                        if (value.length === 4) {
                            value = value[0] | (value[1] << 8) | (value[2] << 16) | (value[3] << 24);
                        } else {
                            console.warn('Integer recipient field ' + subKey + ' has wrong length: ' + value.length);
                            value = 0;
                        }
                    }

                    recipient[name] = value;
                } catch (e) {
                    console.warn('Error reading recipient field ' + subKey + ': ' + e.message);
                }
            }
        }
        
        recipients.push(recipient);
      } catch (e) {
        console.warn('Error reading recipient ' + key + ': ' + e.message);
      }
    });

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
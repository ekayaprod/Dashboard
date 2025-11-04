/**
 * msgreader.js - Enhanced Version
 * Read .msg and .oft files in pure JavaScript with comprehensive error handling
 * Original Source: B-AR (https://github.com/B-AR)
 * Enhanced with: Error handling, OFT support, validation, memory optimization
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
    global.MsgReader = factory({}).default;
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

// Custom error classes for better error handling
var MsgReaderError = function(message) {
  this.name = 'MsgReaderError';
  this.message = message;
  this.stack = (new Error()).stack;
};
MsgReaderError.prototype = Object.create(Error.prototype);
MsgReaderError.prototype.constructor = MsgReaderError;

var CorruptFileError = function(message) {
  this.name = 'CorruptFileError';
  this.message = message;
  this.stack = (new Error()).stack;
};
CorruptFileError.prototype = Object.create(MsgReaderError.prototype);
CorruptFileError.prototype.constructor = CorruptFileError;

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
      throw new MsgReaderError('Failed to parse OLE Compound Document: ' + e.message);
    }
  }

  var _proto = OleCompoundDoc.prototype;

  _proto.readHeader = function readHeader() {
    var ULONG_SIZE = 4;
    var USHORT_SIZE = 2;
    var HEADER_SIGNATURE_SIZE = 8;
    var HEADER_CLSID_SIZE = 16;
    var file = this.file;
    var header = this.header;
    
    // Validate file size
    if (file.arrayBuffer.length < 512) {
      throw new CorruptFileError('File too small to be a valid MSG/OFT file (minimum 512 bytes)');
    }
    
    var d = file.read(HEADER_SIGNATURE_SIZE);
    var signature = '';

    for (var i = 0; i < HEADER_SIGNATURE_SIZE; i++) {
      signature += String.fromCharCode(d[i]);
    }
    
    header.abSig = signature;
    
    // Validate OLE signature
    var validSignatures = [
      '\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1', // Standard OLE signature
      '\x0E\x11\xFC\x0D\xD0\xCF\x11\xE0'  // Alternative signature
    ];
    
    var isValidSignature = validSignatures.some(function(validSig) {
      return signature === validSig;
    });
    
    if (!isValidSignature) {
      throw new CorruptFileError('Invalid OLE signature. This is not a valid MSG/OFT file.');
    }

    d = file.read(HEADER_CLSID_SIZE);
    d = file.read(USHORT_SIZE);
    header.uMinorVersion = d[0];
    d = file.read(USHORT_SIZE);
    header.uMajorVersion = d[0];
    
    // Validate version
    if (header.uMajorVersion !== 3 && header.uMajorVersion !== 4) {
      throw new CorruptFileError('Unsupported OLE version: ' + header.uMajorVersion);
    }
    
    d = file.read(USHORT_SIZE);
    header.uByteOrder = d[0];
    
    // Validate byte order
    if (header.uByteOrder !== 0xFFFE) {
      throw new CorruptFileError('Invalid byte order marker');
    }
    
    d = file.read(USHORT_SIZE);
    header.uSectorShift = d[0];
    
    // Validate sector shift
    if (header.uSectorShift < 7 || header.uSectorShift > 16) {
      throw new CorruptFileError('Invalid sector shift: ' + header.uSectorShift);
    }
    
    header.uSectorSize = 1 << header.uSectorShift;
    d = file.read(USHORT_SIZE);
    header.uMiniSectorShift = d[0];
    
    // Validate mini sector shift
    if (header.uMiniSectorShift < 6 || header.uMiniSectorShift > header.uSectorShift) {
      throw new CorruptFileError('Invalid mini sector shift: ' + header.uMiniSectorShift);
    }
    
    header.uMiniSectorSize = 1 << header.uMiniSectorShift;
    d = file.read(6); // Reserved
    d = file.read(ULONG_SIZE);
    header.cDirSectors = d[0];
    d = file.read(ULONG_SIZE);
    header.cFATSectors = d[0];
    d = file.read(ULONG_SIZE);
    header.sectDirStart = d[0];
    d = file.read(ULONG_SIZE);
    header.signature = d[0];
    d = file.read(ULONG_SIZE);
    header.ulMiniSectorCutoff = d[0];
    
    // Default mini sector cutoff should be 4096
    if (header.ulMiniSectorCutoff === 0) {
      header.ulMiniSectorCutoff = 4096;
    }
    
    d = file.read(ULONG_SIZE);
    header.sectMiniFatStart = d[0];
    d = file.read(ULONG_SIZE);
    header.cMiniFatSectors = d[0];
    d = file.read(ULONG_SIZE);
    header.sectDifStart = d[0];
    d = file.read(ULONG_SIZE);
    header.cDifSectors = d[0];
    var difSectors = [];

    for (var _i = 0; _i < 109; _i++) {
      d = file.read(ULONG_SIZE);
      difSectors[_i] = d[0];
    }

    header.MSAT = difSectors;
  };

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
        
        // Validate sector number
        if (sector === 0xFFFFFFFE || sector === 0xFFFFFFFF) {
          continue;
        }
        
        var offset = 512 + sector * sectorSize;
        if (offset + sectorSize > file.arrayBuffer.length) {
          throw new CorruptFileError('FAT sector ' + sector + ' points beyond file boundary');
        }
        
        file.seek(offset);

        for (var j = 0; j < sectorsInFat; j++) {
          fat.push(file.read(4)[0]);
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
          miniFat.push(file.read(4)[0]);
        }
      }

      var dirSectors = this.readSectorsFromSAT(fat, header.cDirSectors, header.sectDirStart);
      
      if (dirSectors.length === 0) {
        throw new CorruptFileError('No directory sectors found');
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

  _proto.readSectorsFromMSAT = function readSectorsFromMSAT(msat, cDifSectors, sectDifStart, sectorSize) {
    var file = this.file;
    var fatSectors = [];
    var sectorsInFat = sectorSize / 4;
    var difSectors = cDifSectors;
    var visitedSectors = {};
    var maxIterations = 1000; // Prevent infinite loops
    var iterations = 0;

    if (difSectors > 0) {
      var difSector = sectDifStart;

      while (difSector !== 0xFFFFFFFE && difSector !== 0xFFFFFFFF && iterations < maxIterations) {
        // Check for circular references
        if (visitedSectors[difSector]) {
          throw new CorruptFileError('Circular reference detected in MSAT chain');
        }
        visitedSectors[difSector] = true;
        
        var offset = 512 + difSector * sectorSize;
        if (offset + sectorSize > file.arrayBuffer.length) {
          throw new CorruptFileError('DIF sector points beyond file boundary');
        }
        
        file.seek(offset);

        for (var j = 0; j < sectorsInFat - 1; j++) {
          var sector = file.read(4)[0];
          if (sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF) {
            fatSectors.push(sector);
          }
        }

        difSector = file.read(4)[0];
        iterations++;
      }
      
      if (iterations >= maxIterations) {
        throw new CorruptFileError('MSAT chain too long, possible corruption');
      }
    }

    return fatSectors;
  };

  _proto.readSectorsFromSAT = function readSectorsFromSAT(fat, cSectors, sectStart) {
    if (sectStart === 0xFFFFFFFE || sectStart === 0xFFFFFFFF) {
      return [];
    }
    
    var sectors = [];
    var sector = sectStart;
    var visitedSectors = {};
    var maxIterations = Math.max(cSectors * 2, 10000); // Prevent infinite loops
    var iterations = 0;

    for (var i = 0; i < cSectors && sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && iterations < maxIterations; i++) {
      // Check for circular references
      if (visitedSectors[sector]) {
        console.warn('Circular reference detected in SAT chain at sector ' + sector);
        break;
      }
      visitedSectors[sector] = true;
      
      sectors.push(sector);
      
      if (!fat[sector] && fat[sector] !== 0) {
        console.warn('Invalid sector reference in FAT: ' + sector);
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

  _proto.readDirTree = function readDirTree() {
    var file = this.file;
    var header = this.header;
    var sectors = this.sectors;
    var dirSectors = sectors.dirSectors,
        fat = sectors.fat,
        miniFat = sectors.miniFat;
    var streams = {};
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

        // Each sector contains 4 directory entries (128 bytes each)
        for (var j = 0; j < 4; j++) {
          try {
            var entryOffset = file.offset;
            
            // Read name (64 bytes)
            var nameData = file.read(64);
            var name = '';

            for (var k = 0; k < nameData.length; k += 2) {
              if (nameData[k] === 0 && nameData[k + 1] === 0) {
                break;
              }
              // Handle Unicode characters properly
              var charCode = nameData[k] | (nameData[k + 1] << 8);
              if (charCode > 0) {
                name += String.fromCharCode(charCode);
              }
            }

            var d = file.read(2);
            var nameLength = d[0] | (d[1] << 8);

            if (nameLength === 0 || nameLength > 64) {
              continue;
            }

            var d = file.read(1);
            var type = d[0];
            
            // Validate type (0-5 are valid)
            if (type > 5) {
              continue;
            }
            
            var d = file.read(1); // color
            var d = file.read(4);
            var leftChild = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            var d = file.read(4);
            var rightChild = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            var d = file.read(4);
            var storageDirId = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            var d = file.read(16); // CLSID
            var d = file.read(4); // state bits
            var d = file.read(8); // creation time
            var d = file.read(8); // modified time
            var d = file.read(4);
            var sectStart = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            var d = file.read(4);
            var size = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
            var d = file.read(4); // high part of size (for large files)

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
              rootStream = entry;
              this.rootStreamEntry = entry;
            }

            entries.push(entry);
          } catch (entryError) {
            console.warn('Error reading directory entry ' + j + ' in sector ' + i + ': ' + entryError.message);
            // Continue to next entry
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

  _proto.readStorageTree = function readStorageTree(root, entries) {
    var _this = this;

    root.streams = {};
    var stack = [root.storageDirId];
    var visitedEntries = {};
    var maxIterations = entries.length * 2;
    var iterations = 0;

    while (stack.length > 0 && iterations < maxIterations) {
      var entryId = stack.pop();
      iterations++;
      
      // Validate entry ID
      if (entryId < 0 || entryId >= entries.length) {
        continue;
      }
      
      // Check for circular references
      if (visitedEntries[entryId]) {
        console.warn('Circular reference detected in storage tree at entry ' + entryId);
        continue;
      }
      visitedEntries[entryId] = true;
      
      var entry = entries[entryId];

      if (!entry) {
        continue;
      }

      if (entry.type === 1 || entry.type === 2) {
        root.streams[entry.name] = entry;

        if (entry.type === 1) {
          try {
            this.readStorageTree(entry, entries);
          } catch (e) {
            console.warn('Error reading storage subtree for ' + entry.name + ': ' + e.message);
          }
        }
      }

      if (entry.leftChild !== 0xFFFFFFFF && entry.leftChild < entries.length) {
        stack.push(entry.leftChild);
      }

      if (entry.rightChild !== 0xFFFFFFFF && entry.rightChild < entries.length) {
        stack.push(entry.rightChild);
      }
    }

    if (iterations >= maxIterations) {
      console.warn('Storage tree traversal limit reached, possible corruption');
    }

    // Read document summary if present
    if (root.streams['\u0005DocumentSummaryInformation']) {
      try {
        this.readDocumentSummary(root.streams['\u0005DocumentSummaryInformation']);
      } catch (e) {
        console.warn('Error reading document summary: ' + e.message);
      }
    }

    // Read all substg streams
    Object.keys(root.streams).filter(function (key) {
      return key.indexOf('__substg1.0_') > -1;
    }).forEach(function (key) {
      try {
        _this.readStream(root.streams[key]);
      } catch (e) {
        console.warn('Error reading stream ' + key + ': ' + e.message);
      }
    });
    
    // Read attachment streams
    Object.keys(root.streams).filter(function (key) {
      return key.indexOf('__attach_version1.0_') > -1;
    }).forEach(function (key) {
      try {
        var attachStream = root.streams[key];
        if (!attachStream.streams) {
          return;
        }
        var attachStreams = attachStream.streams;
        Object.keys(attachStreams).filter(function (key) {
          return key.indexOf('__substg1.0_') > -1;
        }).forEach(function (key) {
          try {
            _this.readStream(attachStreams[key]);
          } catch (e) {
            console.warn('Error reading attachment stream ' + key + ': ' + e.message);
          }
        });
      } catch (e) {
        console.warn('Error reading attachment ' + key + ': ' + e.message);
      }
    });
    
    // Read recipient streams
    Object.keys(root.streams).filter(function (key) {
      return key.indexOf('__recip_version1.0_') > -1;
    }).forEach(function (key) {
      try {
        var recipStream = root.streams[key];
        if (!recipStream.streams) {
          return;
        }
        var recipStreams = recipStream.streams;
        Object.keys(recipStreams).filter(function (key) {
          return key.indexOf('__substg1.0_') > -1;
        }).forEach(function (key) {
          try {
            _this.readStream(recipStreams[key]);
          } catch (e) {
            console.warn('Error reading recipient stream ' + key + ': ' + e.message);
          }
        });
      } catch (e) {
        console.warn('Error reading recipient ' + key + ': ' + e.message);
      }
    });
  };

  _proto.readStream = function readStream(stream) {
    var file = this.file;
    var header = this.header;
    var sectors = this.sectors;
    var fat = sectors.fat,
        miniFat = sectors.miniFat;

    if (!stream || stream.size === 0) {
      stream.content = [];
      return;
    }

    var sector = stream.sectStart;
    
    // Validate starting sector
    if (sector === 0xFFFFFFFE || sector === 0xFFFFFFFF) {
      stream.content = [];
      return;
    }
    
    var content = [];
    var sectorsChain;
    var sectorSize;
    var useMiniFat = stream.size < header.ulMiniSectorCutoff;

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
        
        var rootStream = this.rootStreamEntry; 
        if (!rootStream) {
          throw new CorruptFileError("Root Entry not found");
        }

        var miniStreamSectors = this.readSectorsFromSAT(fat, Math.ceil(rootStream.size / header.uSectorSize), rootStream.sectStart);
        
        if (miniStreamSectors.length === 0) {
          throw new CorruptFileError('Mini stream sectors not found');
        }
        
        var sectorInMiniStream = Math.floor(sector * sectorSize / header.uSectorSize);
        var offsetInMiniStream = (sector * sectorSize) % header.uSectorSize;
        
        if (sectorInMiniStream >= miniStreamSectors.length) {
          throw new CorruptFileError('Mini stream sector index out of bounds');
        }
        
        var actualOffset = 512 + miniStreamSectors[sectorInMiniStream] * header.uSectorSize + offsetInMiniStream;
        
        if (actualOffset >= file.arrayBuffer.length) {
          throw new CorruptFileError('Mini stream offset points beyond file boundary');
        }
        
        file.seek(actualOffset);
      }

      var bytesLeft = stream.size;
      var visitedSectors = {};
      var maxIterations = Math.ceil(stream.size / sectorSize) * 2;
      var iterations = 0;

      while (bytesLeft > 0 && sector !== 0xFFFFFFFE && sector !== 0xFFFFFFFF && iterations < maxIterations) {
        // Check for circular references
        if (visitedSectors[sector]) {
          throw new CorruptFileError('Circular reference in stream sector chain');
        }
        visitedSectors[sector] = true;
        iterations++;
        
        var bytesToRead = Math.min(bytesLeft, sectorSize);
        var chunk = file.read(bytesToRead);
        
        // Use push.apply for better performance than concat
        Array.prototype.push.apply(content, chunk);
        
        bytesLeft -= bytesToRead;
        
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
              var rootStream = this.rootStreamEntry;
              if (!rootStream) {
                throw new CorruptFileError("Root Entry not found");
              }
              
              var miniStreamSectors = this.readSectorsFromSAT(fat, Math.ceil(rootStream.size / header.uSectorSize), rootStream.sectStart);
              
              var _sectorInMiniStream = Math.floor(sector * sectorSize / header.uSectorSize);
              var _offsetInMiniStream = (sector * sectorSize) % header.uSectorSize;
              
              if (_sectorInMiniStream >= miniStreamSectors.length) {
                console.warn('Mini stream sector index out of bounds, truncating');
                break;
              }
              
              var _actualOffset = 512 + miniStreamSectors[_sectorInMiniStream] * header.uSectorSize + _offsetInMiniStream;
              
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

      stream.content = content;
    } catch (e) {
      console.error('Error reading stream: ' + e.message);
      stream.content = content.length > 0 ? content : [];
      throw e;
    }
  };

  _proto.readDocumentSummary = function readDocumentSummary(stream) {
    try {
      this.readStream(stream);

      if (!stream.content || stream.content.length === 0) {
        return;
      }

      var content = stream.content.slice(); // Create a copy
      
      // Skip header (minimum 28 bytes)
      if (content.length < 28) {
        return;
      }
      
      var d = content.splice(0, 2); // byte order
      var d = content.splice(0, 2); // format
      var d = content.splice(0, 2); // OS version
      var d = content.splice(0, 2); // OS indicator
      var d = content.splice(0, 16); // CLSID
      var d = content.splice(0, 4);
      var sectionCount = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);

      if (sectionCount !== 1 || content.length < 20) {
        return;
      }

      var d = content.splice(0, 16); // Format ID
      var d = content.splice(0, 4);
      var sectionOffset = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
      var d = content.splice(0, 4);
      var propertyCount = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
      
      if (propertyCount > 1000) { // Sanity check
        return;
      }
      
      var properties = [];

      for (var i = 0; i < propertyCount && content.length >= 8; i++) {
        var d = content.splice(0, 4);
        var propertyId = d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24);
        var d = content.splice(0, 4);
        var propertyOffset = d[0] | (d[
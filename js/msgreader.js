/**
 * @file msgreader.js
 * @author B-AR (https://github.com/B-AR)
 * @license MIT
 * @description Read .msg files in pure JavaScript.
 * @version 0.3.0
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
    // MODIFIED: Assign the class constructor directly to global.MsgReader
	(global.MsgReader = factory({}).default);
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

var OleCompoundDoc = function () {
  function OleCompoundDoc(file) {
    this.file = file;
    this.header = {};
    this.sectors = [];
    this.streams = {};
    this.rootStreamEntry = null; // OFT FIX: Added to store root entry
    this.readHeader();
    this.readSectors();
    this.readDirTree();
  }

  var _proto = OleCompoundDoc.prototype;

  _proto.readHeader = function readHeader() {
    var ULONG_SIZE = 4;
    var USHORT_SIZE = 2;
    var HEADER_SIGNATURE_SIZE = 8;
    var HEADER_CLSID_SIZE = 16;
    var file = this.file;
    var header = this.header;
    var d = file.read(HEADER_SIGNATURE_SIZE);

    for (var i = 0; i < HEADER_SIGNATURE_SIZE; i++) {
      header.abSig = (header.abSig || '') + String.fromCharCode(d[i]);
    }

    d = file.read(HEADER_CLSID_SIZE);
    d = file.read(USHORT_SIZE);
    header.uMinorVersion = d[0];
    d = file.read(USHORT_SIZE);
    header.uMajorVersion = d[0];
    d = file.read(USHORT_SIZE);
    header.uByteOrder = d[0];
    d = file.read(USHORT_SIZE);
    header.uSectorShift = d[0];
    header.uSectorSize = 1 << header.uSectorShift;
    d = file.read(USHORT_SIZE);
    header.uMiniSectorShift = d[0];
    header.uMiniSectorSize = 1 << header.uMiniSectorShift;
    d = file.read(6);
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
    var fatSectors = this.readSectorsFromMSAT(header.MSAT, header.cDifSectors, header.sectDifStart, sectorSize);
    var sectorsInFat = sectorSize / 4;
    var fat = [];

    for (var i = 0; i < header.cFATSectors; i++) {
      var sector = fatSectors[i] ? fatSectors[i] : header.MSAT[i];
      file.seek(512 + sector * sectorSize);

      for (var j = 0; j < sectorsInFat; j++) {
        fat.push(file.read(4)[0]);
      }
    }

    var miniFatSectors = this.readSectorsFromSAT(fat, header.cMiniFatSectors, header.sectMiniFatStart);
    var miniFat = [];

    for (var _i2 = 0; _i2 < miniFatSectors.length; _i2++) {
      var _sector = miniFatSectors[_i2];
      file.seek(512 + _sector * sectorSize);

      for (var _j = 0; _j < sectorsInFat; _j++) {
        miniFat.push(file.read(4)[0]);
      }
    }

    var dirSectors = this.readSectorsFromSAT(fat, header.cDirSectors, header.sectDirStart);
    this.sectors = {
      fat: fat,
      miniFat: miniFat,
      dirSectors: dirSectors
    };
  };

  _proto.readSectorsFromMSAT = function readSectorsFromMSAT(msat, cDifSectors, sectDifStart, sectorSize) {
    var file = this.file;
    var fatSectors = [];
    var sectorsInFat = sectorSize / 4;
    var difSectors = cDifSectors;

    if (difSectors > 0) {
      var difSector = sectDifStart;

      while (difSector !== 0xFFFFFFFE) {
        file.seek(512 + difSector * sectorSize);

        for (var j = 0; j < sectorsInFat - 1; j++) {
          fatSectors.push(file.read(4)[0]);
        }

        difSector = file.read(4)[0];
      }
    }

    return fatSectors;
  };

  _proto.readSectorsFromSAT = function readSectorsFromSAT(fat, cSectors, sectStart) {
    var sectors = [];
    var sector = sectStart;

    for (var i = 0; i < cSectors && sector !== 0xFFFFFFFE; i++) {
      sectors.push(sector);
      sector = fat[sector];
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
    var rootStream = {};
    var entries = [];

    for (var i = 0; i < dirSectors.length; i++) {
      var sector = dirSectors[i];
      file.seek(512 + sector * header.uSectorSize);

      for (var j = 0; j < 4; j++) {
        var d = file.read(64);
        var name = '';

        for (var k = 0; k < d.length; k += 2) {
          if (d[k] === 0) {
            break;
          }

          name += String.fromCharCode(d[k]);
        }

        var d = file.read(2);
        var nameLength = d[0];

        if (!nameLength) {
          continue;
        }

        var d = file.read(1);
        var type = d[0];
        var d = file.read(1);
        var d = file.read(4);
        var leftChild = d[0];
        var d = file.read(4);
        var rightChild = d[0];
        var d = file.read(4);
        var storageDirId = d[0];
        var d = file.read(16);
        var d = file.read(4);
        var d = file.read(8);
        var d = file.read(8);
        var d = file.read(8);
        var d = file.read(4);
        var sectStart = d[0];
        var d = file.read(4);
        var size = d[0];
        var d = file.read(4);
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
          this.rootStreamEntry = entry; // OFT FIX: Store the root entry
        }

        entries.push(entry);
      }
    }

    this.readStorageTree(rootStream, entries);
    this.streams = rootStream.streams;
  };

  _proto.readStorageTree = function readStorageTree(root, entries) {
    var _this = this;

    root.streams = {};
    var stack = [root.storageDirId];

    while (stack.length > 0) {
      var entry = entries[stack.pop()];

      if (!entry) {
        continue;
      }

      if (entry.type === 1 || entry.type === 2) {
        root.streams[entry.name] = entry;

        if (entry.type === 1) {
          this.readStorageTree(entry, entries);
        }
      }

      if (entry.leftChild !== 0xFFFFFFFF) {
        stack.push(entry.leftChild);
      }

      if (entry.rightChild !== 0xFFFFFFFF) {
        stack.push(entry.rightChild);
      }
    }

    if (root.streams['\u0006Document Summary Information']) {
      this.readDocumentSummary(root.streams['\u0006Document Summary Information']);
    }

    Object.keys(root.streams).filter(function (key) {
      return key.indexOf('__substg1.0_') > -1;
    }).forEach(function (key) {
      return _this.readStream(root.streams[key]);
    });
    Object.keys(root.streams).filter(function (key) {
      return key.indexOf('__attach_version1.0_') > -1;
    }).forEach(function (key) {
      var attachStream = root.streams[key];
      var attachStreams = attachStream.streams;
      Object.keys(attachStreams).filter(function (key) {
        return key.indexOf('__substg1.0_') > -1;
      }).forEach(function (key) {
        return _this.readStream(attachStreams[key]);
      });
    });
  };

  _proto.readStream = function readStream(stream) {
    var file = this.file;
    var header = this.header;
    var sectors = this.sectors;
    var fat = sectors.fat,
        miniFat = sectors.miniFat;

    if (!stream) {
      return;
    }

    var sector = stream.sectStart;
    var content = [];
    var sectorsChain;
    var sectorSize;

    if (stream.size > header.ulMiniSectorCutoff) {
      sectorsChain = fat;
      sectorSize = header.uSectorSize;
      file.seek(512 + sector * sectorSize);
    } else {
      sectorsChain = miniFat;
      sectorSize = header.uMiniSectorSize;
      
      // OFT FIX: Use this.rootStreamEntry which is set during readDirTree
      // The old code (this.streams['Root Entry']) fails if readStream
      // is called before this.streams is populated.
      var rootStream = this.rootStreamEntry; 
      if (!rootStream) {
        console.error("MsgReader: Could not find Root Entry to read mini-stream. File may be corrupt.");
        stream.content = []; // Set to empty to prevent further errors
        return;
      }

      var miniStreamSectors = this.readSectorsFromSAT(fat, rootStream.size / sectorSize, rootStream.sectStart);
      var sectorInMiniStream = Math.floor(sector * sectorSize / header.uSectorSize);
      var offsetInMiniStream = sector * sectorSize % header.uSectorSize;
      file.seek(512 + miniStreamSectors[sectorInMiniStream] * header.uSectorSize + offsetInMiniStream);
    }

    var bytesLeft = stream.size;

    while (bytesLeft > 0 && sector !== 0xFFFFFFFE) {
      var bytesToRead = bytesLeft > sectorSize ? sectorSize : bytesLeft;
      content = content.concat(file.read(bytesToRead));
      bytesLeft -= bytesToRead;
      sector = sectorsChain[sector];

      if (bytesLeft > 0 && sector !== 0xFFFFFFFE) {
        if (stream.size > header.ulMiniSectorCutoff) {
          file.seek(512 + sector * sectorSize);
        } else {
          var _sectorInMiniStream = Math.floor(sector * sectorSize / header.uSectorSize);

          var _offsetInMiniStream = sector * sectorSize % header.uSectorSize;
          
          // OFT FIX: Need to re-calculate rootStream and miniStreamSectors, as they are not defined in this scope
          var rootStream = this.rootStreamEntry;
          if (!rootStream) {
             console.error("MsgReader: Could not find Root Entry to read mini-stream. File may be corrupt.");
             stream.content = [];
             return;
          }
          var miniStreamSectors = this.readSectorsFromSAT(fat, rootStream.size / sectorSize, rootStream.sectStart);
          // End OFT FIX

          file.seek(512 + miniStreamSectors[_sectorInMiniStream] * header.uSectorSize + _offsetInMiniStream);
        }
      }
    }

    stream.content = content;
  };

  _proto.readDocumentSummary = function readDocumentSummary(stream) {
    this.readStream(stream);

    if (stream.content) {
      var content = stream.content;
      var d = content.splice(0, 2);
      var d = content.splice(0, 2);
      var d = content.splice(0, 2);
      var d = content.splice(0, 2);
      var d = content.splice(0, 16);
      var d = content.splice(0, 4);
      var sectionCount = d[0];

      if (sectionCount !== 1) {
        return;
      }

      var d = content.splice(0, 16);
      var d = content.splice(0, 4);
      var d = content.splice(0, 4);
      var propertyCount = d[0];
      var properties = [];

      for (var i = 0; i < propertyCount; i++) {
        var d = content.splice(0, 4);
        var propertyId = d[0];
        var d = content.splice(0, 4);
        var propertyOffset = d[0];
        properties.push({
          id: propertyId,
          offset: propertyOffset
        });
      }

      var d = content.splice(0, 4);
      var propertySize = d[0];
      var d = content.splice(0, 4);
      var type = d[0];

      if (type === 0x001E) {
        var d = content.splice(0, 4);
        var size = d[0];
        var value = '';

        for (var _i3 = 0; _i3 < size; _i3++) {
          if (content[_i3] === 0) {
            break;
          }

          value += String.fromCharCode(content[_i3]);
        }
      }
    }
  };

  return OleCompoundDoc;
}();

var ReadFile = function () {
  function ReadFile(arrayBuffer) {
    this.arrayBuffer = arrayBuffer;
    this.offset = 0;
  }

  var _proto = ReadFile.prototype;

  _proto.read = function read(length) {
    var data = [];

    for (var i = 0; i < length; i++) {
      data[i] = this.arrayBuffer[this.offset + i];
    }

    this.offset += length;
    return data;
  };

  _proto.seek = function seek(offset) {
    this.offset = offset;
  };

  return ReadFile;
}();

var propertyTypes = {
  BINARY: 0x0102,
  STRING: 0x001F,
  UNICODE_STRING: 0x001F,
  OBJECT: 0x000D
};
var propertyTags = {
  BODY: 0x1000,
  HTML: 0x1013
};
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
  0x370E: 'attachmentMimeTag'
};
var data = {
  propertyTypes: propertyTypes,
  propertyTags: propertyTags,
  propertyNames: propertyNames
};

var FieldsData = function () {
  function FieldsData(fields) {
    this.fields = fields;
    this.fieldsByName = {};
    this.fieldsById = {};

    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var name = data.propertyNames[field.nameId];

      if (name) {
        this.fieldsByName[name] = field;
      }

      this.fieldsById[field.nameId] = field;
    }
  }

  var _proto = FieldsData.prototype;

  _proto.getField = function getField(name) {
    return this.fieldsByName[name];
  };

  _proto.getFieldById = function getFieldById(id) {
    return this.fieldsById[id];
  };

  return FieldsData;
}();

var Property = function () {
  function Property(buffer) {
    this.buffer = buffer;
    this.properties = [];
    this.readProperties();
  }

  var _proto = Property.prototype;

  _proto.readProperties = function readProperties() {
    var buffer = this.buffer;
    buffer.seek(32);

    while (buffer.offset < buffer.arrayBuffer.length) {
      var d = buffer.read(4);
      var nameId = d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24;
      d = buffer.read(4);
      var flags = d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24;
      d = buffer.read(8);
      var size = d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24;
      var data = buffer.read(size);

      while (buffer.offset % 4 !== 0) {
        buffer.read(1);
      }

      this.properties.push({
        nameId: nameId,
        flags: flags,
        size: size,
        data: data
      });
    }
  };

  return Property;
}();

var Reader = function () {
  function Reader(arrayBuffer) {
    this.arrayBuffer = arrayBuffer;
  }

  var _proto = Reader.prototype;

  _proto.read = function read() {
    var buffer = this.arrayBuffer;
    var file = new ReadFile(buffer);
    var oleCompoundDoc = new OleCompoundDoc(file);
    var fields = this.readFields(oleCompoundDoc);
    return new FieldsData(fields);
  };

  _proto.readFields = function readFields(oleCompoundDoc) {
    var streams = oleCompoundDoc.streams;
    if (!streams) {
        console.error("MsgReader: OLE streams not found.");
        return [];
    }
    var propertyStream = streams['__properties_version1.0'];

    if (!propertyStream) {
      console.warn("MsgReader: Property stream '__properties_version1.0' not found. File may be an OFT or a different format.");
      // return []; // Don't return, as OFT might store properties differently (though unlikely for basic fields)
    }

    // OFT FIX: Even if propertyStream is missing, try to read other streams
    var fields = [];
    var attachments = [];

    if (propertyStream) {
        var property = new Property(new ReadFile(propertyStream.content));
        // Note: The original code implicitly read properties from propertyStream,
        // but it seems to only be used for iteration logic that's not present.
        // We will proceed to read streams directly.
    }


    Object.keys(streams).filter(function (key) {
      return key.indexOf('__substg1.0_') > -1;
    }).forEach(function (key) {
      var stream = streams[key];
      var type = key.substring(key.length - 4, key.length);
      var nameId = parseInt(key.substring('__substg1.0_'.length, key.length - 4), 16);
      var name = data.propertyNames[nameId];
      var value = stream.content;

      if (type === '001F') {
        value = String.fromCharCode.apply(String, _toConsumableArray(value.filter(function (v) {
          return v !== 0;
        })));
      }

      fields.push({
        name: name,
        nameId: nameId,
        type: type,
        value: value
      });
    });
    Object.keys(streams).filter(function (key) {
      return key.indexOf('__attach_version1.0_') > -1;
    }).forEach(function (key, index) {
      var attachStream = streams[key];
      if (!attachStream.streams) {
        console.warn("MsgReader: Attachment stream found but contains no sub-streams.", key);
        return;
      }
      var attachStreams = attachStream.streams;
      var attachment = {};
      Object.keys(attachStreams).filter(function (key) {
        return key.indexOf('__substg1.0_') > -1;
      }).forEach(function (key) {
        var stream = attachStreams[key];
        var type = key.substring(key.length - 4, key.length);
        var nameId = parseInt(key.substring('__substg1.0_'.length, key.length - 4), 16);
        var name = data.propertyNames[nameId];
        var value = stream.content;

        if (type === '001F') {
          value = String.fromCharCode.apply(String, _toConsumableArray(value.filter(function (v) {
            return v !== 0;
          })));
        }

        attachment[name] = value;
      });
      attachments.push({
        data: attachment.attachmentData,
        name: attachment.attachmentFilename,
        mime: attachment.attachmentMimeTag,
        size: attachment.attachmentSize
      });
    });

    if (attachments.length) {
      fields.push({
        name: 'attachments',
        nameId: 0,
        type: 0,
        value: attachments
      });
    }

    var recipient = {};
    Object.keys(streams).filter(function (key) {
      return key.indexOf('__recip_version1.0_') > -1;
    }).forEach(function (key, index) {
      var recipStream = streams[key];
      if (!recipStream.streams) {
        console.warn("MsgReader: Recipient stream found but contains no sub-streams.", key);
        return;
      }
      var recipStreams = recipStream.streams;
      var recipient = {};
      Object.keys(recipStreams).filter(function (key) {
        return key.indexOf('__substg1.0_') > -1;
      }).forEach(function (key) {
        var stream = recipStreams[key];
        var type = key.substring(key.length - 4, key.length);
        var nameId = parseInt(key.substring('__substg1.0_'.length, key.length - 4), 16);
        var name = data.propertyNames[nameId];
        var value = stream.content;

        if (type === '001F') {
          value = String.fromCharCode.apply(String, _toConsumableArray(value.filter(function (v) {
            return v !== 0;
          })));
        }

        recipient[name] = value;
      });

      if (!fields.find(function (field) {
        return field.name === 'recipients';
      })) {
        fields.push({
          name: 'recipients',
          nameId: 0,
          type: 0,
          value: []
        });
      }

      var recipients = fields.find(function (field) {
        return field.name === 'recipients';
      }).value;
      var recipientType = recipient.recipientType;
      recipients.push({
        name: recipient.recipientSmtpAddress || recipient.recipientName || recipient.recipientEmail || recipient.recipientDisplayName,
        email: recipient.recipientSmtpAddress || recipient.recipientEmail || recipient.recipientEmailAddress,
        type: recipientType === 1 ? 'to' : recipientType === 2 ? 'cc' : recipientType === 3 ? 'bcc' : undefined
      });
    });
    return fields;
  };

  return Reader;
}();

var MsgReader = function () {
  function MsgReader(arrayBuffer) {
    this.reader = new Reader(arrayBuffer);
    this.fields = this.reader.read();
  }

  var _proto = MsgReader.prototype;

  _proto.getFileData = function getFileData() {
    var body = this.fields.getField('body');
    var html = this.fields.getField('html');
    return {
      senderName: this.fields.getField('senderName') ? this.fields.getField('senderName').value : undefined,
      senderEmail: this.fields.getField('senderEmail') ? this.fields.getField('senderEmail').value : undefined,
      senderSmtpAddress: this.fields.getField('senderSmtpAddress') ? this.fields.getField('senderSmtpAddress').value : undefined,
      subject: this.fields.getField('subject') ? this.fields.getField('subject').value : undefined,
      normalizedSubject: this.fields.getField('normalizedSubject') ? this.fields.getField('normalizedSubject').value : undefined,
      subjectPrefix: this.fields.getField('subjectPrefix') ? this.fields.getField('subjectPrefix').value : undefined,
      body: body ? body.value : undefined,
      html: html ? html.value : undefined,
      headers: this.fields.getField('headers') ? this.fields.getField('headers').value : undefined,
      attachments: this.fields.getField('attachments') ? this.fields.getField('attachments').value : [],
      recipients: this.fields.getField('recipients') ? this.fields.getField('recipients').value : []
    };
  };

  return MsgReader;
}();

exports.default = MsgReader;

Object.defineProperty(exports, '__esModule', { value: true });

// MODIFIED: Return the exports object so the wrapper can access .default
return exports;
})));
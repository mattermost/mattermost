"use strict";

const iconv = require("iconv-lite");

const parseContentType = require("./headers").parseContentType;

// https://encoding.spec.whatwg.org/encodings.json
const encodings = require("./encodings.json");
const encodingsTable = {};
encodings.forEach(v => v.encodings.forEach(enc => {
  if (iconv.encodingExists(enc.name)) {
    enc.labels.forEach(label => {
      encodingsTable[label] = enc.name;
    });
  }
}));

function canonicalizeEncoding(enc) {
  return enc ? enc.trim().toLowerCase() : null;
}

const normalizeEncoding = exports.normalizeEncoding = function (enc) {
  return enc ? encodingsTable[canonicalizeEncoding(enc)] || null : null;
};

exports.decodeString = function decodeString(buffer, options) {
  let encoding = options.contentType ? normalizeEncoding(options.contentType.get("charset")) : null;
  if (buffer.length >= 2) {
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      encoding = "UTF-16BE";
    } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      encoding = "UTF-16LE";
    } else if (buffer.length >= 3 &&
        buffer[0] === 0xEF &&
        buffer[1] === 0xBB &&
        buffer[2] === 0xBF) {
      encoding = "UTF-8";
    }
  }
  if (!encoding && options.detectMetaCharset) {
    encoding = prescanMetaCharset(buffer);
  }
  encoding = encoding || options.defaultEncoding;
  return { data: iconv.decode(buffer, encoding), encoding };
};

// https://html.spec.whatwg.org/multipage/syntax.html#prescan-a-byte-stream-to-determine-its-encoding
function prescanMetaCharset(buffer) {
  const l = Math.min(buffer.length, 1024);
  for (let i = 0; i < l; i++) {
    let c = buffer[i];
    if (c === 0x3C) {
      // "<"
      let c1 = buffer[i + 1];
      let c2 = buffer[i + 2];
      const c3 = buffer[i + 3];
      const c4 = buffer[i + 4];
      const c5 = buffer[i + 5];
      // !-- (comment start)
      if (c1 === 0x21 && c2 === 0x2D && c3 === 0x2D) {
        i += 4;
        for (; i < l; i++) {
          c = buffer[i];
          c1 = buffer[i + 1];
          c2 = buffer[i + 2];
          // --> (comment end)
          if (c === 0x2D && c1 === 0x2D && c2 === 0x3E) {
            i += 2;
            break;
          }
        }
      } else if ((c1 === 0x4D || c1 === 0x6D) &&
         (c2 === 0x45 || c2 === 0x65) &&
         (c3 === 0x54 || c3 === 0x74) &&
         (c4 === 0x41 || c4 === 0x61) &&
         (c5 === 0x09 || c5 === 0x0A || c5 === 0x0C || c5 === 0x0D || c5 === 0x20 || c5 === 0x2F)) {
        // "meta" + space or /
        i += 6;
        let gotPragma = false;
        let needPragma = null;
        let charset = null;

        let attrRes;
        do {
          attrRes = getAttribute(buffer, i, l);
          if (attrRes.attr) {
            if (attrRes.attr.name === "http-equiv") {
              gotPragma = attrRes.attr.value === "content-type";
            } else if (attrRes.attr.name === "content" && !charset) {
              const contentType = parseContentType(attrRes.attr.value);
              if (contentType && contentType.get("charset")) {
                charset = contentType.get("charset");
                needPragma = true;
              }
            } else if (attrRes.attr.name === "charset") {
              charset = attrRes.attr.value;
              needPragma = false;
            }
          }
          i = attrRes.i;
        } while (attrRes.attr);
        if (needPragma === null) {
          continue;
        }
        if (needPragma === true && gotPragma === false) {
          continue;
        }
        if (charset === "x-user-defined") {
          return "windows-1252";
        }
        charset = normalizeEncoding(charset);
        if (!charset) {
          continue;
        }
        return charset;
      } else if ((c1 >= 0x41 && c1 <= 0x5A) || (c1 >= 0x61 && c1 <= 0x7A)) {
        // a-z or A-Z
        for (i += 2; i < l; i++) {
          c = buffer[i];
          // space or >
          if (c === 0x09 || c === 0x0A || c === 0x0C || c === 0x0D || c === 0x20 || c === 0x3E) {
            break;
          }
        }
        let attrRes;
        do {
          attrRes = getAttribute(buffer, i, l);
          i = attrRes.i;
        } while (attrRes.attr);
      } else if (c1 === 0x21 || c1 === 0x2F || c1 === 0x3F) {
        // ! or / or ?
        for (i += 2; i < l; i++) {
          c = buffer[i];
          // >
          if (c === 0x3E) {
            break;
          }
        }
      }
    }
  }
  return null;
}

// https://html.spec.whatwg.org/multipage/syntax.html#concept-get-attributes-when-sniffing
function getAttribute(buffer, i, l) {
  for (; i < l; i++) {
    let c = buffer[i];
    // space or /
    if (c === 0x09 || c === 0x0A || c === 0x0C || c === 0x0D || c === 0x20 || c === 0x2F) {
      continue;
    }
    // ">"
    if (c === 0x3E) {
      i++;
      break;
    }
    let name = "";
    let value = "";
    nameLoop:for (; i < l; i++) {
      c = buffer[i];
      // "="
      if (c === 0x3D && name !== "") {
        i++;
        break;
      }
      // space
      if (c === 0x09 || c === 0x0A || c === 0x0C || c === 0x0D || c === 0x20) {
        for (i++; i < l; i++) {
          c = buffer[i];
          // space
          if (c === 0x09 || c === 0x0A || c === 0x0C || c === 0x0D || c === 0x20) {
            continue;
          }
          // not "="
          if (c !== 0x3D) {
            return { attr: { name, value }, i };
          }

          i++;
          break nameLoop;
        }
        break;
      }
      // / or >
      if (c === 0x2F || c === 0x3E) {
        return { attr: { name, value }, i };
      }
      // A-Z
      if (c >= 0x41 && c <= 0x5A) {
        name += String.fromCharCode(c + 0x20); // lowercase
      } else {
        name += String.fromCharCode(c);
      }
    }
    c = buffer[i];
    // space
    if (c === 0x09 || c === 0x0A || c === 0x0C || c === 0x0D || c === 0x20) {
      for (i++; i < l; i++) {
        c = buffer[i];
        // space
        if (c === 0x09 || c === 0x0A || c === 0x0C || c === 0x0D || c === 0x20) {
          continue;
        } else {
          break;
        }
      }
    }
    // " or '
    if (c === 0x22 || c === 0x27) {
      const quote = c;
      for (i++; i < l; i++) {
        c = buffer[i];

        if (c === quote) {
          i++;
          return { attr: { name, value }, i };
        }

        // A-Z
        if (c >= 0x41 && c <= 0x5A) {
          value += String.fromCharCode(c + 0x20); // lowercase
        } else {
          value += String.fromCharCode(c);
        }
      }
    }

    // >
    if (c === 0x3E) {
      return { attr: { name, value }, i };
    }

    // A-Z
    if (c >= 0x41 && c <= 0x5A) {
      value += String.fromCharCode(c + 0x20); // lowercase
    } else {
      value += String.fromCharCode(c);
    }

    for (i++; i < l; i++) {
      c = buffer[i];

      // space or >
      if (c === 0x09 || c === 0x0A || c === 0x0C || c === 0x0D || c === 0x20 || c === 0x3E) {
        return { attr: { name, value }, i };
      }

      // A-Z
      if (c >= 0x41 && c <= 0x5A) {
        value += String.fromCharCode(c + 0x20); // lowercase
      } else {
        value += String.fromCharCode(c);
      }
    }
  }
  return { i };
}

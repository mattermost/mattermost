'use strict';

/**
 * Check if a Buffer/Uint8Array is a ZIP file
 *
 * @param {Buffer} buf
 * @api public
 */

module.exports = function (buf) {
    if (!buf || buf.length < 4) {
        return false;
    }

    return buf[0] === 80 && buf[1] === 75 && (buf[2] === 3 || buf[2] === 5 || buf[2] === 7) && (buf[3] === 4 || buf[3] === 6 || buf[3] === 8);
};

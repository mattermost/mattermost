var crypto = require('crypto')
if (crypto.pbkdf2Sync.toString().indexOf('keylen, digest') === -1) {
  throw new Error('Unsupported crypto version')
}

exports.pbkdf2Sync = crypto.pbkdf2Sync
exports.pbkdf2 = crypto.pbkdf2

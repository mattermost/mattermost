'use strict';

var fo = require('../../fileOperations');

function writeBuffer(writePath, file, written) {
  var opt = {
    mode: file.stat.mode,
    flag: file.flag,
  };

  fo.writeFile(writePath, file.contents, opt, onWriteFile);

  function onWriteFile(writeErr, fd) {
    if (writeErr) {
      return fo.closeFd(writeErr, fd, written);
    }

    fo.updateMetadata(fd, file, onUpdate);
  }

  function onUpdate(statErr, fd) {
    fo.closeFd(statErr, fd, written);
  }
}

module.exports = writeBuffer;

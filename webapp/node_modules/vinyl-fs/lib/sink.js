'use strict';

var Writable = require('readable-stream/writable');

function listenerCount(stream, evt) {
  return stream.listeners(evt).length;
}

function hasListeners(stream) {
  return !!(listenerCount(stream, 'readable') || listenerCount(stream, 'data'));
}

function sink(stream) {
  var sinkAdded = false;
  var sinkStream = new Writable({
    objectMode: true,
    write: function(file, enc, cb) {
      cb();
    },
  });

  function addSink() {
    if (sinkAdded) {
      return;
    }

    if (hasListeners(stream)) {
      return;
    }

    sinkAdded = true;
    stream.pipe(sinkStream);
  }

  function removeSink(evt) {
    if (evt !== 'readable' && evt !== 'data') {
      return;
    }

    if (hasListeners(stream)) {
      sinkAdded = false;
      stream.unpipe(sinkStream);
    }
  }

  stream.on('newListener', removeSink);
  stream.on('removeListener', removeSink);
  stream.on('removeListener', addSink);

  return addSink;
}

module.exports = sink;

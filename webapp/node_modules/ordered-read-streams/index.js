var Readable = require('readable-stream/readable');
var isReadable = require('is-stream').readable;
var util = require('util');

function addStream(streams, stream)
{
  if(!isReadable(stream)) throw new Error('All input streams must be readable');

  var self = this;

  stream._buffer = [];

  stream.on('readable', function()
  {
    var chunk = stream.read();
    if (chunk === null)
      return;

    if(this === streams[0])
      self.push(chunk);

    else
      this._buffer.push(chunk);
  });

  stream.on('end', function()
  {
    for(var stream = streams[0];
        stream && stream._readableState.ended;
        stream = streams[0])
    {
      while(stream._buffer.length)
        self.push(stream._buffer.shift());

      streams.shift();
    }

    if(!streams.length) self.push(null);
  });

  stream.on('error', this.emit.bind(this, 'error'));

  streams.push(stream);
}


function OrderedStreams(streams, options) {
  if (!(this instanceof(OrderedStreams))) {
    return new OrderedStreams(streams, options);
  }

  streams = streams || [];
  options = options || {};

  options.objectMode = true;

  Readable.call(this, options);


  if(!Array.isArray(streams)) streams = [streams];
  if(!streams.length) return this.push(null);  // no streams, close


  var addStream_bind = addStream.bind(this, []);


  streams.forEach(function(item)
  {
    if(Array.isArray(item))
      item.forEach(addStream_bind);

    else
      addStream_bind(item);
  });
}
util.inherits(OrderedStreams, Readable);

OrderedStreams.prototype._read = function () {};


module.exports = OrderedStreams;

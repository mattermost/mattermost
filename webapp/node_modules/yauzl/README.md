# yauzl

[![Build Status](https://travis-ci.org/thejoshwolfe/yauzl.svg?branch=master)](https://travis-ci.org/thejoshwolfe/yauzl)
[![Coverage Status](https://img.shields.io/coveralls/thejoshwolfe/yauzl.svg)](https://coveralls.io/r/thejoshwolfe/yauzl)

yet another unzip library for node. For zipping, see
[yazl](https://github.com/thejoshwolfe/yazl).

Design principles:

 * Follow the spec.
   Don't scan for local file headers.
   Read the central directory for file metadata.
   (see [No Streaming Unzip API](#no-streaming-unzip-api)).
 * Don't block the JavaScript thread.
   Use and provide async APIs.
 * Keep memory usage under control.
   Don't attempt to buffer entire files in RAM at once.
 * Never crash (if used properly).
   Don't let malformed zip files bring down client applications who are trying to catch errors.
 * Catch unsafe file names.
   See `validateFileName()`.

## Usage

```js
var yauzl = require("yauzl");
var fs = require("fs");
var path = require("path");
var mkdirp = require("mkdirp"); // or similar

yauzl.open("path/to/file.zip", {lazyEntries: true}, function(err, zipfile) {
  if (err) throw err;
  zipfile.readEntry();
  zipfile.on("entry", function(entry) {
    if (/\/$/.test(entry.fileName)) {
      // directory file names end with '/'
      mkdirp(entry.fileName, function(err) {
        if (err) throw err;
        zipfile.readEntry();
      });
    } else {
      // file entry
      zipfile.openReadStream(entry, function(err, readStream) {
        if (err) throw err;
        // ensure parent directory exists
        mkdirp(path.dirname(entry.fileName), function(err) {
          if (err) throw err;
          readStream.pipe(fs.createWriteStream(entry.fileName));
          readStream.on("end", function() {
            zipfile.readEntry();
          });
        });
      });
    }
  });
});
```

## API

The default for every optional `callback` parameter is:

```js
function defaultCallback(err) {
  if (err) throw err;
}
```

### open(path, [options], [callback])

Calls `fs.open(path, "r")` and reads the `fd` effectively the same as `fromFd()` would.

`options` may be omitted or `null`. The defaults are `{autoClose: true, lazyEntries: false, decodeStrings: true}`.

`autoClose` is effectively equivalent to:

```js
zipfile.once("end", function() {
  zipfile.close();
});
```

`lazyEntries` indicates that entries should be read only when `readEntry()` is called.
If `lazyEntries` is `false`, `entry` events will be emitted as fast as possible to allow `pipe()`ing
file data from all entries in parallel.
This is not recommended, as it can lead to out of control memory usage for zip files with many entries.
See [issue #22](https://github.com/thejoshwolfe/yauzl/issues/22).
If `lazyEntries` is `true`, an `entry` or `end` event will be emitted in response to each call to `readEntry()`.
This allows processing of one entry at a time, and will keep memory usage under control for zip files with many entries.

`decodeStrings` is the default and causes yauzl to decode strings with `CP437` or `UTF-8` as required by the spec.
The exact effects of turning this option off are:

* `zipfile.comment`, `entry.fileName`, and `entry.fileComment` will be `Buffer` objects instead of `String`s.
* Any Info-ZIP Unicode Path Extra Field will be ignored. See `extraFields`.
* Automatic file name validation will not be performed. See `validateFileName()`.

The `callback` is given the arguments `(err, zipfile)`.
An `err` is provided if the End of Central Directory Record cannot be found, or if its metadata appears malformed.
This kind of error usually indicates that this is not a zip file.
Otherwise, `zipfile` is an instance of `ZipFile`.

### fromFd(fd, [options], [callback])

Reads from the fd, which is presumed to be an open .zip file.
Note that random access is required by the zip file specification,
so the fd cannot be an open socket or any other fd that does not support random access.

`options` may be omitted or `null`. The defaults are `{autoClose: false, lazyEntries: false, decodeStrings: true}`.

See `open()` for the meaning of the options and callback.

### fromBuffer(buffer, [options], [callback])

Like `fromFd()`, but reads from a RAM buffer instead of an open file.
`buffer` is a `Buffer`.

If a `ZipFile` is acquired from this method,
it will never emit the `close` event,
and calling `close()` is not necessary.

`options` may be omitted or `null`. The defaults are `{lazyEntries: false, decodeStrings: true}`.

See `open()` for the meaning of the options and callback.
The `autoClose` option is ignored for this method.

### fromRandomAccessReader(reader, totalSize, [options], [callback])

This method of reading a zip file allows clients to implement their own back-end file system.
For example, a client might translate read calls into network requests.

The `reader` parameter must be of a type that is a subclass of
[RandomAccessReader](#class-randomaccessreader) that implements the required methods.
The `totalSize` is a Number and indicates the total file size of the zip file.

`options` may be omitted or `null`. The defaults are `{autoClose: true, lazyEntries: false, decodeStrings: true}`.

See `open()` for the meaning of the options and callback.

### dosDateTimeToDate(date, time)

Converts MS-DOS `date` and `time` data into a JavaScript `Date` object.
Each parameter is a `Number` treated as an unsigned 16-bit integer.
Note that this format does not support timezones,
so the returned object will use the local timezone.

### validateFileName(fileName)

Returns `null` or a `String` error message depending on the validity of `fileName`.
If `fileName` starts with `"/"` or `/[A-Za-z]:\//` or if it contains `".."` path segments or `"\\"`,
this function returns an error message appropriate for use like this:

```js
var errorMessage = yauzl.validateFileName(fileName);
if (errorMessage != null) throw new Error(errorMessage);
```

This function is automatically run for each entry, as long as `decodeStrings` is `true`.
See `open()` and `Event: "entry"` for more information.

### Class: ZipFile

The constructor for the class is not part of the public API.
Use `open()`, `fromFd()`, `fromBuffer()`, or `fromRandomAccessReader()` instead.

#### Event: "entry"

Callback gets `(entry)`, which is an `Entry`.
See `open()` and `readEntry()` for when this event is emitted.

If `decodeStrings` is `true`, entries emitted via this event have already passed file name validation.
See `validateFileName()` and `open()` for more information.

#### Event: "end"

Emitted after the last `entry` event has been emitted.
See `open()` and `readEntry()` for more info on when this event is emitted.

#### Event: "close"

Emitted after the fd is actually closed.
This is after calling `close()` (or after the `end` event when `autoClose` is `true`),
and after all stream pipelines created from `openReadStream()` have finished reading data from the fd.

If this `ZipFile` was acquired from `fromRandomAccessReader()`,
the "fd" in the previous paragraph refers to the `RandomAccessReader` implemented by the client.

If this `ZipFile` was acquired from `fromBuffer()`, this event is never emitted.

#### Event: "error"

Emitted in the case of errors with reading the zip file.
(Note that other errors can be emitted from the streams created from `openReadStream()` as well.)
After this event has been emitted, no further `entry`, `end`, or `error` events will be emitted,
but the `close` event may still be emitted.

#### readEntry()

Causes this `ZipFile` to emit an `entry` or `end` event (or an `error` event).
This method must only be called when this `ZipFile` was created with the `lazyEntries` option set to `true` (see `open()`).
When this `ZipFile` was created with the `lazyEntries` option set to `true`,
`entry` and `end` events are only ever emitted in response to this method call.

The event that is emitted in response to this method will not be emitted until after this method has returned,
so it is safe to call this method before attaching event listeners.

After calling this method, calling this method again before the response event has been emitted will cause undefined behavior.
Calling this method after the `end` event has been emitted will cause undefined behavior.
Calling this method after calling `close()` will cause undefined behavior.

#### openReadStream(entry, callback)

`entry` must be an `Entry` object from this `ZipFile`.
`callback` gets `(err, readStream)`, where `readStream` is a `Readable Stream`.
If the entry is compressed (with a supported compression method),
the read stream provides the decompressed data.
If this zipfile is already closed (see `close()`), the `callback` will receive an `err`.

It's possible for the `readStream` it to emit errors for several reasons.
For example, if zlib cannot decompress the data, the zlib error will be emitted from the `readStream`.
Two more error cases are if the decompressed data has too many or too few actual bytes
compared to the reported byte count from the entry's `uncompressedSize` field.
yauzl notices this false information and emits an error from the `readStream`
after some number of bytes have already been piped through the stream.

Because of this check, clients can always trust the `uncompressedSize` field in `Entry` objects.
Guarding against [zip bomb](http://en.wikipedia.org/wiki/Zip_bomb) attacks can be accomplished by
doing some heuristic checks on the size metadata and then watching out for the above errors.
Such heuristics are outside the scope of this library,
but enforcing the `uncompressedSize` is implemented here as a security feature.

It is possible to destroy the `readStream` before it has piped all of its data.
To do this, call `readStream.destroy()`.
You must `unpipe()` the `readStream` from any destination before calling `readStream.destroy()`.
If this zipfile was created using `fromRandomAccessReader()`, the `RandomAccessReader` implementation
must provide readable streams that implement a `.destroy()` method (see `randomAccessReader._readStreamForRange()`)
in order for calls to `readStream.destroy()` to work in this context.

#### close()

Causes all future calls to `openReadStream()` to fail,
and closes the fd after all streams created by `openReadStream()` have emitted their `end` events.

If the `autoClose` option is set to `true` (see `open()`),
this function will be called automatically effectively in response to this object's `end` event.

If the `lazyEntries` option is set to `false` (see `open()`) and this object's `end` event has not been emitted yet,
this function causes undefined behavior.
If the `lazyEntries` option is set to `true`,
you can call this function instead of calling `readEntry()` to abort reading the entries of a zipfile.

It is safe to call this function multiple times; after the first call, successive calls have no effect.
This includes situations where the `autoClose` option effectively calls this function for you.

#### isOpen

`Boolean`. `true` until `close()` is called; then it's `false`.

#### entryCount

`Number`. Total number of central directory records.

#### comment

`String`. Always decoded with `CP437` per the spec.

If `decodeStrings` is `false` (see `open()`), this field is the undecoded `Buffer` instead of a decoded `String`.

### Class: Entry

Objects of this class represent Central Directory Records.
Refer to the zipfile specification for more details about these fields.

These fields are of type `Number`:

 * `versionMadeBy`
 * `versionNeededToExtract`
 * `generalPurposeBitFlag`
 * `compressionMethod`
 * `lastModFileTime` (MS-DOS format, see `getLastModDateTime`)
 * `lastModFileDate` (MS-DOS format, see `getLastModDateTime`)
 * `crc32`
 * `compressedSize`
 * `uncompressedSize`
 * `fileNameLength` (bytes)
 * `extraFieldLength` (bytes)
 * `fileCommentLength` (bytes)
 * `internalFileAttributes`
 * `externalFileAttributes`
 * `relativeOffsetOfLocalHeader`

#### fileName

`String`.
Following the spec, the bytes for the file name are decoded with
`UTF-8` if `generalPurposeBitFlag & 0x800`, otherwise with `CP437`.
Alternatively, this field may be populated from the Info-ZIP Unicode Path Extra Field
(see `extraFields`).

This field is automatically validated by `validateFileName()` before yauzl emits an "entry" event.
If this field would contain unsafe characters, yauzl emits an error instead of an entry.

If `decodeStrings` is `false` (see `open()`), this field is the undecoded `Buffer` instead of a decoded `String`.
Therefore, `generalPurposeBitFlag` and any Info-ZIP Unicode Path Extra Field are ignored.
Furthermore, no automatic file name validation is performed for this file name.

#### extraFields

`Array` with each entry in the form `{id: id, data: data}`,
where `id` is a `Number` and `data` is a `Buffer`.

This library looks for and reads the ZIP64 Extended Information Extra Field (0x0001)
in order to support ZIP64 format zip files.

This library also looks for and reads the Info-ZIP Unicode Path Extra Field (0x7075)
in order to support some zipfiles that use it instead of General Purpose Bit 8
to convey `UTF-8` file names.
When the field is identified and verified to be reliable (see the zipfile spec),
the the file name in this field is stored in the `fileName` property,
and the file name in the central directory record for this entry is ignored.
Note that when `decodeStrings` is false, all Info-ZIP Unicode Path Extra Fields are ignored.

None of the other fields are considered significant by this library.
Fields that this library reads are left unalterned in the `extraFields` array.

#### fileComment

`String` decoded with the charset indicated by `generalPurposeBitFlag & 0x800` as with the `fileName`.
(The Info-ZIP Unicode Path Extra Field has no effect on the charset used for this field.)

If `decodeStrings` is `false` (see `open()`), this field is the undecoded `Buffer` instead of a decoded `String`.

Prior to yauzl version 2.7.0, this field was erroneously documented as `comment` instead of `fileComment`.
For compatibility with any code that uses the field name `comment`,
yauzl creates an alias field named `comment` which is identical to `fileComment`.

#### getLastModDate()

Effectively implemented as:

```js
return dosDateTimeToDate(this.lastModFileDate, this.lastModFileTime);
```

### Class: RandomAccessReader

This class is meant to be subclassed by clients and instantiated for the `fromRandomAccessReader()` function.

An example implementation can be found in `test/test.js`.

#### randomAccessReader._readStreamForRange(start, end)

Subclasses *must* implement this method.

`start` and `end` are Numbers and indicate byte offsets from the start of the file.
`end` is exclusive, so `_readStreamForRange(0x1000, 0x2000)` would indicate to read `0x1000` bytes.
`end - start` will always be at least `1`.

This method should return a readable stream which will be `pipe()`ed into another stream.
It is expected that the readable stream will provide data in several chunks if necessary.
If the readable stream provides too many or too few bytes, an error will be emitted.
Any errors emitted on the readable stream will be handled and re-emitted on the client-visible stream
(returned from `zipfile.openReadStream()`) or provided as the `err` argument to the appropriate callback
(for example, for `fromRandomAccessReader()`).

The returned stream *must* implement a method `.destroy()`
if you call `readStream.destroy()` on streams you get from `openReadStream()`.
If you never call `readStream.destroy()`, then streams returned from this method do not need to implement a method `.destroy()`.
`.destroy()` should abort any streaming that is in progress and clean up any associated resources.
`.destroy()` will only be called after the stream has been `unpipe()`d from its destination.

Note that the stream returned from this method might not be the same object that is provided by `openReadStream()`.
The stream returned from this method might be `pipe()`d through one or more filter streams (for example, a zlib inflate stream).

#### randomAccessReader.read(buffer, offset, length, position, callback)

Subclasses may implement this method.
The default implementation uses `createReadStream()` to fill the `buffer`.

This method should behave like `fs.read()`.

#### randomAccessReader.close(callback)

Subclasses may implement this method.
The default implementation is effectively `setImmediate(callback);`.

`callback` takes parameters `(err)`.

This method is called once the all streams returned from `_readStreamForRange()` have ended,
and no more `_readStreamForRange()` or `read()` requests will be issued to this object.

## How to Avoid Crashing

When a malformed zipfile is encountered, the default behavior is to crash (throw an exception).
If you want to handle errors more gracefully than this,
be sure to do the following:

 * Provide `callback` parameters where they are allowed, and check the `err` parameter.
 * Attach a listener for the `error` event on any `ZipFile` object you get from `open()`, `fromFd()`, `fromBuffer()`, or `fromRandomAccessReader()`.
 * Attach a listener for the `error` event on any stream you get from `openReadStream()`.

## Limitations

### No Streaming Unzip API

Due to the design of the .zip file format, it's impossible to interpret a .zip file from start to finish
(such as from a readable stream) without sacrificing correctness.
The Central Directory, which is the authority on the contents of the .zip file, is at the end of a .zip file, not the beginning.
A streaming API would need to either buffer the entire .zip file to get to the Central Directory before interpreting anything
(defeating the purpose of a streaming interface), or rely on the Local File Headers which are interspersed through the .zip file.
However, the Local File Headers are explicitly denounced in the spec as being unreliable copies of the Central Directory,
so trusting them would be a violation of the spec.

Any library that offers a streaming unzip API must make one of the above two compromises,
which makes the library either dishonest or nonconformant (usually the latter).
This library insists on correctness and adherence to the spec, and so does not offer a streaming API.

### Limitted ZIP64 Support

For ZIP64, only zip files smaller than `8PiB` are supported,
not the full `16EiB` range that a 64-bit integer should be able to index.
This is due to the JavaScript Number type being an IEEE 754 double precision float.

The Node.js `fs` module probably has this same limitation.

### ZIP64 Extensible Data Sector Is Ignored

The spec does not allow zip file creators to put arbitrary data here,
but rather reserves its use for PKWARE and mentions something about Z390.
This doesn't seem useful to expose in this library, so it is ignored.

### No Multi-Disk Archive Support

This library does not support multi-disk zip files.
The multi-disk fields in the zipfile spec were intended for a zip file to span multiple floppy disks,
which probably never happens now.
If the "number of this disk" field in the End of Central Directory Record is not `0`,
the `open()`, `fromFd()`, `fromBuffer()`, or `fromRandomAccessReader()` `callback` will receive an `err`.
By extension the following zip file fields are ignored by this library and not provided to clients:

 * Disk where central directory starts
 * Number of central directory records on this disk
 * Disk number where file starts

### No Encryption Support

Currently, the presence of encryption is not even checked,
and encrypted zip files will cause undefined behavior.

### Local File Headers Are Ignored

Many unzip libraries mistakenly read the Local File Header data in zip files.
This data is officially defined to be redundant with the Central Directory information,
and is not to be trusted.
Aside from checking the signature, yauzl ignores the content of the Local File Header.

### No CRC-32 Checking

This library provides the `crc32` field of `Entry` objects read from the Central Directory.
However, this field is not used for anything in this library.

### versionNeededToExtract Is Ignored

The field `versionNeededToExtract` is ignored,
because this library doesn't support the complete zip file spec at any version,

### No Support For Obscure Compression Methods

Regarding the `compressionMethod` field of `Entry` objects,
only method `0` (stored with no compression)
and method `8` (deflated) are supported.
Any of the other 15 official methods will cause the `openReadStream()` `callback` to receive an `err`.

### Data Descriptors Are Ignored

There may or may not be Data Descriptor sections in a zip file.
This library provides no support for finding or interpreting them.

### Archive Extra Data Record Is Ignored

There may or may not be an Archive Extra Data Record section in a zip file.
This library provides no support for finding or interpreting it.

### No Language Encoding Flag Support

Zip files officially support charset encodings other than CP437 and UTF-8,
but the zip file spec does not specify how it works.
This library makes no attempt to interpret the Language Encoding Flag.

## Change History

 * 2.7.0
   * Added option `decodeStrings`. [issue #42](https://github.com/thejoshwolfe/yauzl/issues/42)
   * Fixed documentation for `entry.fileComment` and added compatibility alias. [issue #47](https://github.com/thejoshwolfe/yauzl/issues/47)
 * 2.6.0
   * Support Info-ZIP Unicode Path Extra Field, used by WinRAR for Chinese file names. [issue #33](https://github.com/thejoshwolfe/yauzl/issues/33)
 * 2.5.0
   * Ignore malformed Extra Field that is common in Android .apk files. [issue #31](https://github.com/thejoshwolfe/yauzl/issues/31)
 * 2.4.3
   * Fix crash when parsing malformed Extra Field buffers. [issue #31](https://github.com/thejoshwolfe/yauzl/issues/31)
 * 2.4.2
   * Remove .npmignore and .travis.yml from npm package.
 * 2.4.1
   * Fix error handling.
 * 2.4.0
   * Add ZIP64 support. [issue #6](https://github.com/thejoshwolfe/yauzl/issues/6)
   * Add `lazyEntries` option. [issue #22](https://github.com/thejoshwolfe/yauzl/issues/22)
   * Add `readStream.destroy()` method. [issue #26](https://github.com/thejoshwolfe/yauzl/issues/26)
   * Add `fromRandomAccessReader()`. [issue #14](https://github.com/thejoshwolfe/yauzl/issues/14)
   * Add `examples/unzip.js`.
 * 2.3.1
   * Documentation updates.
 * 2.3.0
   * Check that `uncompressedSize` is correct, or else emit an error. [issue #13](https://github.com/thejoshwolfe/yauzl/issues/13)
 * 2.2.1
   * Update dependencies.
 * 2.2.0
   * Update dependencies.
 * 2.1.0
   * Remove dependency on `iconv`.
 * 2.0.3
   * Fix crash when trying to read a 0-byte file.
 * 2.0.2
   * Fix event behavior after errors.
 * 2.0.1
   * Fix bug with using `iconv`.
 * 2.0.0
   * Initial release.

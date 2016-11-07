[![Build Status](https://secure.travis-ci.org/fshost/node-dir.svg)](http://travis-ci.org/fshost/node-dir)

# node-dir
A lightweight Node.js module with methods for some common directory and file operations, including asynchronous, non-blocking methods for recursively getting an array of files, subdirectories, or both, and methods for recursively, sequentially reading and processing the contents of files in a directory and its subdirectories, with several options available for added flexibility if needed.

#### installation

    npm install node-dir

#### methods
For the sake of brevity, assume that the following line of code precedes all of the examples.

```javascript
var dir = require('node-dir');
```

#### readFiles( dir, [options], fileCallback, [finishedCallback] )
#### readFilesStream( dir, [options], streamCallback, [finishedCallback] )
Sequentially read the content of each file in a directory, passing the contents to a callback, optionally calling a finished callback when complete.  The options and finishedCallback arguments are not required.

Valid options are:
- encoding: file encoding (defaults to 'utf8')
- exclude: a regex pattern or array to specify filenames to ignore
- excludeDir: a regex pattern or array to specify directories to ignore
- match: a regex pattern or array to specify filenames to operate on
- matchDir: a regex pattern or array to specify directories to recurse 
- recursive: whether to recurse subdirectories when reading files (defaults to true)
- reverse: sort files in each directory in descending order
- shortName: whether to aggregate only the base filename rather than the full filepath
- sort: sort files in each directory in ascending order (defaults to true)
- doneOnErr: control if done function called on error (defaults to true)

A reverse sort can also be achieved by setting the sort option to 'reverse', 'desc', or 'descending' string value.

examples

```javascript
// display contents of files in this script's directory
dir.readFiles(__dirname,
    function(err, content, next) {
        if (err) throw err;
        console.log('content:', content);
        next();
    },
    function(err, files){
        if (err) throw err;
        console.log('finished reading files:', files);
    });

// display contents of huge files in this script's directory
dir.readFilesStream(__dirname,
    function(err, stream, next) {
        if (err) throw err;
        var content = '';
        stream.on('data',function(buffer) {
            content += buffer.toString();
        });
        stream.on('end',function() {
            console.log('content:', content);
            next();
        });
    },
    function(err, files){
        if (err) throw err;
        console.log('finished reading files:', files);
    });

// match only filenames with a .txt extension and that don't start with a `.´
dir.readFiles(__dirname, {
    match: /.txt$/,
    exclude: /^\./
    }, function(err, content, next) {
        if (err) throw err;
        console.log('content:', content);
        next();
    },
    function(err, files){
        if (err) throw err;
        console.log('finished reading files:',files);
    });

// exclude an array of subdirectory names
dir.readFiles(__dirname, {
    exclude: ['node_modules', 'test']
    }, function(err, content, next) {
        if (err) throw err;
        console.log('content:', content);
        next();
    },
    function(err, files){
        if (err) throw err;
        console.log('finished reading files:',files);
    });


// the callback for each file can optionally have a filename argument as its 3rd parameter
// and the finishedCallback argument is optional, e.g.
dir.readFiles(__dirname, function(err, content, filename, next) {
        console.log('processing content of file', filename);
        next();
    });
```

        
#### files( dir, callback )
Asynchronously iterate the files of a directory and its subdirectories and pass an array of file paths to a callback.
    
```javascript
dir.files(__dirname, function(err, files) {
    if (err) throw err;
    console.log(files);
});
```

Note that for the files and subdirs the object returned is an array, and thus all of the standard array methods are available for use in your callback for operations like filters or sorting. Some quick examples:

```javascript
dir.files(__dirname, function(err, files) {
    if (err) throw err;
    // sort ascending
    files.sort();
    // sort descending
    files.reverse();
    // include only certain filenames
    files = files.filter(function (file) {
       return ['allowed', 'file', 'names'].indexOf(file) > -1;
    });
    // exclude some filenames
    files = files.filter(function (file) {
        return ['exclude', 'these', 'files'].indexOf(file) === -1;
    });
});
```

Also note that if you need to work with the contents of the files asynchronously, please use the readFiles method.  The files and subdirs methods are for getting a list of the files or subdirs in a directory as an array.
        
#### subdirs( dir, callback )
Asynchronously iterate the subdirectories of a directory and its subdirectories and pass an array of directory paths to a callback.

```javascript
dir.subdirs(__dirname, function(err, subdirs) {
    if (err) throw err;
    console.log(subdirs);
});
```

#### paths(dir, [combine], callback )
Asynchronously iterate the subdirectories of a directory and its subdirectories and pass an array of both file and directory paths to a callback.

Separated into two distinct arrays (paths.files and paths.dirs)

```javascript
dir.paths(__dirname, function(err, paths) {
    if (err) throw err;
    console.log('files:\n',paths.files);
    console.log('subdirs:\n', paths.dirs);
});
```


Combined in a single array (convenience method for concatenation of the above)

```javascript
dir.paths(__dirname, true, function(err, paths) {
    if (err) throw err;
    console.log('paths:\n',paths);
});
```


## License
MIT licensed (See LICENSE.txt)

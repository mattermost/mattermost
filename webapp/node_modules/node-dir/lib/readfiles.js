var fs = require('fs'),
    path = require('path');

/**
 * merge two objects by extending target object with source object
 * @param target object to merge
 * @param source object to merge
 * @param {Boolean} [modify] whether to modify the target
 * @returns {Object} extended object
 */
function extend(target, source, modify) {
    var result = target ? modify ? target : extend({}, target, true) : {};
    if (!source) return result;
    for (var key in source) {
        if (source.hasOwnProperty(key) && source[key] !== undefined) {
            result[key] = source[key];
        }
    }
    return result;
}

/**
 * determine if a string is contained within an array or matches a regular expression
 * @param   {String} str string to match
 * @param   {Array|Regex} match array or regular expression to match against
 * @returns {Boolean} whether there is a match
 */
function matches(str, match) {
    if (Array.isArray(match)) return match.indexOf(str) > -1;
    return match.test(str);
}

/**
 * read files and call a function with the contents of each file
 * @param  {String} dir path of dir containing the files to be read
 * @param  {String} encoding file encoding (default is 'utf8')
 * @param  {Object} options options hash for encoding, recursive, and match/exclude
 * @param  {Function(error, string)} callback  callback for each files content
 * @param  {Function(error)}   complete  fn to call when finished
 */
function readFiles(dir, options, callback, complete) {
    if (typeof options === 'function') {
        complete = callback;
        callback = options;
        options = {};
    }
    if (typeof options === 'string') options = {
        encoding: options
    };
    options = extend({
        recursive: true,
        encoding: 'utf8',
        doneOnErr: true
    }, options);
    var files = [];

    var done = function(err) {
        if (typeof complete === 'function') {
            if (err) return complete(err);
            complete(null, files);
        }
    };

    fs.readdir(dir, function(err, list) {
        if (err)  {
            if (options.doneOnErr === true) {
              if (err.code === 'EACCES') return done();
              return done(err);
            }
        }
        var i = 0;

        if (options.reverse === true ||
            (typeof options.sort == 'string' &&
                (/reverse|desc/i).test(options.sort))) {
            list = list.reverse();
        } else if (options.sort !== false) list = list.sort();

        (function next() {
            var filename = list[i++];
            if (!filename) return done(null, files);
            var file = path.join(dir, filename);
            fs.stat(file, function(err, stat) {
                if (err && options.doneOnErr === true) return done(err);
                if (stat && stat.isDirectory()) {
                    if (options.recursive) {
                        if (options.matchDir && !matches(filename, options.matchDir)) return next();
                        if (options.excludeDir && matches(filename, options.excludeDir)) return next();
                        readFiles(file, options, callback, function(err, sfiles) {
                            if (err && options.doneOnErr === true) return done(err);
                            files = files.concat(sfiles);
                            next();
                        });
                    } else next();
                } else if (stat && stat.isFile()) {
                    if (options.match && !matches(filename, options.match)) return next();
                    if (options.exclude && matches(filename, options.exclude)) return next();
                    if (options.filter && !options.filter(filename)) return next();
                    if (options.shortName) files.push(filename);
                    else files.push(file);
                    fs.readFile(file, options.encoding, function(err, data) {
                        if (err) {
                            if (err.code === 'EACCES') return next();
                            if (options.doneOnErr === true) {
                                return done(err);
                            }
                        }
                        if (callback.length > 3)
                            if (options.shortName) callback(null, data, filename, next);
                            else callback(null, data, file, next);
                            else callback(null, data, next);
                    });
                }
                else {
                    next();
                }
            });
        })();

    });
}
module.exports = readFiles;

/* jshint quotmark: false */
'use strict';

require('colors');

var FS = require('fs'),
    PATH = require('path'),
    SVGO = require('../svgo.js'),
    YAML = require('js-yaml'),
    PKG = require('../../package.json'),
    mkdirp = require('mkdirp'),
    encodeSVGDatauri = require('./tools.js').encodeSVGDatauri,
    decodeSVGDatauri = require('./tools.js').decodeSVGDatauri,
    regSVGFile = /\.svg$/;

/**
 * Command-Option-Argument.
 *
 * @see https://github.com/veged/coa
 */
module.exports = require('coa').Cmd()
    .helpful()
    .name(PKG.name)
    .title(PKG.description)
    .opt()
        .name('version').title('Version')
        .short('v').long('version')
        .only()
        .flag()
        .act(function() {
            // output the version to stdout instead of stderr if returned
            process.stdout.write(PKG.version + '\n');
            // coa will run `.toString` on the returned value and send it to stderr
            return '';
        })
        .end()
    .opt()
        .name('input').title('Input file, "-" for STDIN')
        .short('i').long('input')
        .val(function(val) {
            return val || this.reject("Option '--input' must have a value.");
        })
        .end()
    .opt()
        .name('string').title('Input SVG data string')
        .short('s').long('string')
        .end()
    .opt()
        .name('folder').title('Input folder, optimize and rewrite all *.svg files')
        .short('f').long('folder')
        .val(function(val) {
            return val || this.reject("Option '--folder' must have a value.");
        })
        .end()
    .opt()
        .name('output').title('Output file or folder (by default the same as the input), "-" for STDOUT')
        .short('o').long('output')
        .val(function(val) {
            return val || this.reject("Option '--output' must have a value.");
        })
        .end()
    .opt()
        .name('precision').title('Set number of digits in the fractional part, overrides plugins params')
        .short('p').long('precision')
        .val(function(val) {
            return !isNaN(val) ? val : this.reject("Option '--precision' must be an integer number");
        })
        .end()
    .opt()
        .name('config').title('Config file to extend or replace default')
        .long('config')
        .val(function(val) {
            return val || this.reject("Option '--config' must have a value.");
        })
        .end()
    .opt()
        .name('disable').title('Disable plugin by name')
        .long('disable')
        .arr()
        .val(function(val) {
            return val || this.reject("Option '--disable' must have a value.");
        })
        .end()
    .opt()
        .name('enable').title('Enable plugin by name')
        .long('enable')
        .arr()
        .val(function(val) {
            return val || this.reject("Option '--enable' must have a value.");
        })
        .end()
    .opt()
        .name('datauri').title('Output as Data URI string (base64, URI encoded or unencoded)')
        .long('datauri')
        .val(function(val) {
            return val || this.reject("Option '--datauri' must have one of the following values: 'base64', 'enc' or 'unenc'");
        })
        .end()
    .opt()
        .name('multipass').title('Enable multipass')
        .long('multipass')
        .flag()
        .end()
    .opt()
        .name('pretty').title('Make SVG pretty printed')
        .long('pretty')
        .flag()
        .end()
    .opt()
        .name('indent').title('Indent number when pretty printing SVGs')
        .long('indent')
        .val(function(val) {
            return !isNaN(val) ? val : this.reject("Option '--indent' must be an integer number");
        })
        .end()
    .opt()
        .name('quiet').title('Only output error messages, not regular status messages')
        .short('q').long('quiet')
        .flag()
        .end()
    .opt()
        .name('show-plugins').title('Show available plugins and exit')
        .long('show-plugins')
        .flag()
        .end()
    .arg()
        .name('input').title('Alias to --input')
        .end()
    .arg()
        .name('output').title('Alias to --output')
        .end()
    .act(function(opts, args) {

        var input = args && args.input ? args.input : opts.input,
            output = args && args.output ? args.output : opts.output,
            config = {};

        // --show-plugins
        if (opts['show-plugins']) {

            showAvailablePlugins();
            process.exit(0);

        }

        // w/o anything
        if (
            (!input || input === '-') &&
            !opts.string &&
            !opts.stdin &&
            !opts.folder &&
            process.stdin.isTTY
        ) return this.usage();


        // --config
        if (opts.config) {

            // string
            if (opts.config.charAt(0) === '{') {
                try {
                    config = JSON.parse(opts.config);
                } catch (e) {
                    console.error("Error: Couldn't parse config JSON.");
                    console.error(String(e));
                    return;
                }

            // external file
            } else {
                var configPath = PATH.resolve(opts.config);
                try {
                    // require() adds some weird output on YML files
                    config = JSON.parse(FS.readFileSync(configPath, 'utf8'));
                } catch (err) {
                    if (err.code === 'ENOENT') {
                        console.error('Error: couldn\'t find config file \'' + opts.config + '\'.');
                        return;
                    } else if (err.code === 'EISDIR') {
                        console.error('Error: directory \'' + opts.config + '\' is not a config file.');
                        return;
                    }
                    config = YAML.safeLoad(FS.readFileSync(configPath, 'utf8'));

                    if (!config || Array.isArray(config)) {
                        console.error('Error: invalid config file \'' + opts.config + '\'.');
                        return;
                    }
                }
            }

        }

        // --quiet
        if (opts.quiet) {
            config.quiet = opts.quiet;
        }

        // --precision
        if (opts.precision) {
            config.floatPrecision = Math.max(0, parseInt(opts.precision));
        }

        // --disable
        if (opts.disable) {
            changePluginsState(opts.disable, false, config);
        }

        // --enable
        if (opts.enable) {
            changePluginsState(opts.enable, true, config);
        }

        // --multipass
        if (opts.multipass) {

            config.multipass = true;

        }

        // --pretty
        if (opts.pretty) {

            config.js2svg = config.js2svg || {};
            config.js2svg.pretty = true;
            if (opts.indent) {
                config.js2svg.indent = parseInt(opts.indent, 10);
            }

        }

        // --output
        if (opts.output) {
            config.output = opts.output;
        }

        // --folder
        if (opts.folder) {
            optimizeFolder(opts.folder, config, output);

            return;
        }

        // --input
        if (input) {

            // STDIN
            if (input === '-') {

                var data = '';

                process.stdin.pause();

                process.stdin
                    .on('data', function(chunk) {
                        data += chunk;
                    })
                    .once('end', function() {
                        optimizeFromString(data, config, opts.datauri, input, output);
                    })
                    .resume();

            // file
            } else {

                FS.readFile(input, 'utf8', function(err, data) {
                    if (err) {
                        if (err.code === 'EISDIR')
                            optimizeFolder(input, config, output);
                        else if (err.code === 'ENOENT')
                            console.error('Error: no such file or directory \'' + input + '\'.');
                        else
                            console.error(err);
                        return;
                    }
                    optimizeFromString(data, config, opts.datauri, input, output);
                });

            }

        // --string
        } else if (opts.string) {

            opts.string = decodeSVGDatauri(opts.string);

            optimizeFromString(opts.string, config, opts.datauri, input, output);

        }
    });

function optimizeFromString(svgstr, config, datauri, input, output) {

    var startTime = Date.now(config),
        time,
        inBytes = Buffer.byteLength(svgstr, 'utf8'),
        outBytes,
        svgo = new SVGO(config);

    svgo.optimize(svgstr, function(result) {

        if (result.error) {
            console.error(result.error);
            return;
        }

        if (datauri) {
            result.data = encodeSVGDatauri(result.data, datauri);
        }

        outBytes = Buffer.byteLength(result.data, 'utf8');
        time = Date.now() - startTime;

        // stdout
        if (output === '-' || (!input || input === '-') && !output) {

            process.stdout.write(result.data + '\n');

        // file
        } else {

            // overwrite input file if there is no output
            if (!output && input) {
                output = input;
            }

            if (!config.quiet) {
                console.log('\r');
            }

            saveFileAndPrintInfo(config, result.data, output, inBytes, outBytes, time);

        }

    });

}

function saveFileAndPrintInfo(config, data, path, inBytes, outBytes, time) {

    FS.writeFile(path, data, 'utf8', function() {
        if (config.quiet) {
            return;
        }

        // print time info
        printTimeInfo(time);

        // print optimization profit info
        printProfitInfo(inBytes, outBytes);

    });

}

function printTimeInfo(time) {
    console.log('Done in ' + time + ' ms!');

}

function printProfitInfo(inBytes, outBytes) {

    var profitPercents = 100 - outBytes * 100 / inBytes;

    console.log(
        (Math.round((inBytes / 1024) * 1000) / 1000) + ' KiB' +
        (profitPercents < 0 ? ' + ' : ' - ') +
        String(Math.abs((Math.round(profitPercents * 10) / 10)) + '%').green + ' = ' +
        (Math.round((outBytes / 1024) * 1000) / 1000) + ' KiB\n'
    );

}

/**
 * Change plugins state by names array.
 *
 * @param {Array} names plugins names
 * @param {Boolean} state active state
 * @param {Object} config original config
 * @return {Object} changed config
 */
function changePluginsState(names, state, config) {

    // extend config
    if (config.plugins) {

        names.forEach(function(name) {

            var matched,
                key;

            config.plugins.forEach(function(plugin) {

                // get plugin name
                if (typeof plugin === 'object') {
                    key = Object.keys(plugin)[0];
                } else {
                    key = plugin;
                }

                // if there is such a plugin name
                if (key === name) {
                    // don't replace plugin's params with true
                    if (typeof plugin[key] !== 'object' || !state) {
                        plugin[key] = state;
                    }

                    // mark it as matched
                    matched = true;
                }

            });

            // if not matched and current config is not full
            if (!matched && !config.full) {

                var obj = {};

                obj[name] = state;

                // push new plugin Object
                config.plugins.push(obj);

                matched = true;

            }

        });

    // just push
    } else {

        config.plugins = [];

        names.forEach(function(name) {
            var obj = {};

            obj[name] = state;

            config.plugins.push(obj);
        });

    }

    return config;

}

function optimizeFolder(dir, config, output) {

    var svgo = new SVGO(config);

    if (!config.quiet) {
        console.log('Processing directory \'' + dir + '\':\n');
    }

    // absoluted folder path
    var path = PATH.resolve(dir);

    // list folder content
    FS.readdir(path, function(err, files) {

        if (err) {
            console.error(err);
            return;
        }

        if (!files.length) {
            console.log('Directory \'' + dir + '\' is empty.');
            return;
        }

        var i = 0,
            found = false;

        function optimizeFile(file) {

            // absoluted file path
            var filepath = PATH.resolve(path, file);
            var outfilepath = output ? PATH.resolve(output, file) : filepath;

            // check if file name matches *.svg
            if (regSVGFile.test(filepath)) {

                found = true;
                FS.readFile(filepath, 'utf8', function(err, data) {

                    if (err) {
                        console.error(err);
                        return;
                    }

                    var startTime = Date.now(),
                        time,
                        inBytes = Buffer.byteLength(data, 'utf8'),
                        outBytes;

                    svgo.optimize(data, function(result) {

                        if (result.error) {
                            console.error(result.error);
                            return;
                        }

                        outBytes = Buffer.byteLength(result.data, 'utf8');
                        time = Date.now() - startTime;

                        writeOutput();

                        function writeOutput() {
                            FS.writeFile(outfilepath, result.data, 'utf8', report);
                        }

                        function report(err) {

                            if (err) {
                                if (err.code === 'ENOENT') {
                                    mkdirp(output, writeOutput);
                                    return;
                                } else if (err.code === 'ENOTDIR') {
                                    console.error('Error: output \'' + output + '\' is not a directory.');
                                    return;
                                }
                                console.error(err);
                                return;
                            }

                            if (!config.quiet) {
                                console.log(file + ':');

                                // print time info
                                printTimeInfo(time);

                                // print optimization profit info
                                printProfitInfo(inBytes, outBytes);
                            }

                            //move on to the next file
                            if (++i < files.length) {
                                optimizeFile(files[i]);
                            }

                        }

                    });

                });

            }
            //move on to the next file
            else if (++i < files.length) {
                optimizeFile(files[i]);
            } else if (!found) {
                console.log('No SVG files have been found.');
            }


        }

        optimizeFile(files[i]);

    });

}


var showAvailablePlugins = function () {

    var svgo = new SVGO(),
        // Flatten an array of plugins grouped per type and sort alphabetically
        list = Array.prototype.concat.apply([], svgo.config.plugins).sort(function(a, b) {
            return a.name > b.name ? 1 : -1;
        });

    console.log('Currently available plugins:');

    list.forEach(function (plugin) {
        console.log(' [ ' + plugin.name.green + ' ] ' + plugin.description);
    });

    //console.log(JSON.stringify(svgo, null, 4));
};

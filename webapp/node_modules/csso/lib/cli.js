var fs = require('fs');
var path = require('path');
var cli = require('clap');
var SourceMapConsumer = require('source-map').SourceMapConsumer;
var csso = require('./index.js');

function readFromStream(stream, minify) {
    var buffer = [];

    // FIXME: don't chain until node.js 0.10 drop, since setEncoding isn't chainable in 0.10
    stream.setEncoding('utf8');
    stream
        .on('data', function(chunk) {
            buffer.push(chunk);
        })
        .on('end', function() {
            minify(buffer.join(''));
        });
}

function showStat(filename, source, result, inputMap, map, time, mem) {
    function fmt(size) {
        return String(size).split('').reverse().reduce(function(size, digit, idx) {
            if (idx && idx % 3 === 0) {
                size = ' ' + size;
            }
            return digit + size;
        }, '');
    }

    map = map || 0;
    result -= map;

    console.error('Source:    ', filename === '<stdin>' ? filename : path.relative(process.cwd(), filename));
    if (inputMap) {
        console.error('Map source:', inputMap);
    }
    console.error('Original:  ', fmt(source), 'bytes');
    console.error('Compressed:', fmt(result), 'bytes', '(' + (100 * result / source).toFixed(2) + '%)');
    console.error('Saving:    ', fmt(source - result), 'bytes', '(' + (100 * (source - result) / source).toFixed(2) + '%)');
    if (map) {
        console.error('Source map:', fmt(map), 'bytes', '(' + (100 * map / (result + map)).toFixed(2) + '% of total)');
        console.error('Total:     ', fmt(map + result), 'bytes');
    }
    console.error('Time:      ', time, 'ms');
    console.error('Memory:    ', (mem / (1024 * 1024)).toFixed(3), 'MB');
}

function showParseError(source, filename, details, message) {
    function processLines(start, end) {
        return lines.slice(start, end).map(function(line, idx) {
            var num = String(start + idx + 1);

            while (num.length < maxNumLength) {
                num = ' ' + num;
            }

            return num + ' |' + line;
        }).join('\n');
    }

    var lines = source.split(/\n|\r\n?|\f/);
    var column = details.column;
    var line = details.line;
    var startLine = Math.max(1, line - 2);
    var endLine = Math.min(line + 2, lines.length + 1);
    var maxNumLength = Math.max(4, String(endLine).length) + 1;

    console.error('\nParse error ' + filename + ': ' + message);
    console.error(processLines(startLine - 1, line));
    console.error(new Array(column + maxNumLength + 2).join('-') + '^');
    console.error(processLines(line, endLine));
    console.error();
}

function debugLevel(level) {
    // level is undefined when no param -> 1
    return isNaN(level) ? 1 : Math.max(Number(level), 0);
}

function resolveSourceMap(source, inputMap, map, inputFile, outputFile) {
    var inputMapContent = null;
    var inputMapFile = null;
    var outputMapFile = null;

    switch (map) {
        case 'none':
            // don't generate source map
            map = false;
            inputMap = 'none';
            break;

        case 'inline':
            // nothing to do
            break;

        case 'file':
            if (!outputFile) {
                console.error('Output filename should be specified when `--map file` is used');
                process.exit(2);
            }

            outputMapFile = outputFile + '.map';
            break;

        default:
            // process filename
            if (map) {
                // check path is reachable
                if (!fs.existsSync(path.dirname(map))) {
                    console.error('Directory for map file should exists:', path.dirname(path.resolve(map)));
                    process.exit(2);
                }

                // resolve to absolute path
                outputMapFile = path.resolve(process.cwd(), map);
            }
    }

    switch (inputMap) {
        case 'none':
            // nothing to do
            break;

        case 'auto':
            if (map) {
                // try fetch source map from source
                var inputMapComment = source.match(/\/\*# sourceMappingURL=(\S+)\s*\*\/\s*$/);

                if (inputFile === '<stdin>') {
                    inputFile = false;
                }

                if (inputMapComment) {
                    // if comment found – value is filename or base64-encoded source map
                    inputMapComment = inputMapComment[1];

                    if (inputMapComment.substr(0, 5) === 'data:') {
                        // decode source map content from comment
                        inputMapContent = new Buffer(inputMapComment.substr(inputMapComment.indexOf('base64,') + 7), 'base64').toString();
                    } else {
                        // value is filename – resolve it as absolute path
                        if (inputFile) {
                            inputMapFile = path.resolve(path.dirname(inputFile), inputMapComment);
                        }
                    }
                } else {
                    // comment doesn't found - look up file with `.map` extension nearby input file
                    if (inputFile && fs.existsSync(inputFile + '.map')) {
                        inputMapFile = inputFile + '.map';
                    }
                }

            }
            break;

        default:
            if (inputMap) {
                inputMapFile = inputMap;
            }
    }

    // source map placed in external file
    if (inputMapFile) {
        inputMapContent = fs.readFileSync(inputMapFile, 'utf8');
    }

    return {
        input: inputMapContent,
        inputFile: inputMapFile || (inputMapContent ? '<inline>' : false),
        output: map,
        outputFile: outputMapFile
    };
}

function processCommentsOption(value) {
    switch (value) {
        case 'exclamation':
        case 'first-exclamation':
        case 'none':
            return value;
    }

    console.error('Wrong value for `comments` option: %s', value);
    process.exit(2);
}

var command = cli.create('csso', '[input] [output]')
    .version(require('../package.json').version)
    .option('-i, --input <filename>', 'Input file')
    .option('-o, --output <filename>', 'Output file (result outputs to stdout if not set)')
    .option('-m, --map <destination>', 'Generate source map: none (default), inline, file or <filename>', 'none')
    .option('-u, --usage <filenane>', 'Usage data file')
    .option('--input-map <source>', 'Input source map: none, auto (default) or <filename>', 'auto')
    .option('--restructure-off', 'Turns structure minimization off')
    .option('--comments <value>', 'Comments to keep: exclamation (default), first-exclamation or none', 'exclamation')
    .option('--stat', 'Output statistics in stderr')
    .option('--debug [level]', 'Output intermediate state of CSS during compression', debugLevel, 0)
    .action(function(args) {
        var options = this.values;
        var inputFile = options.input || args[0];
        var outputFile = options.output || args[1];
        var usageFile = options.usage;
        var usageData = false;
        var map = options.map;
        var inputMap = options.inputMap;
        var structureOptimisationOff = options.restructureOff;
        var comments = processCommentsOption(options.comments);
        var debug = options.debug;
        var statistics = options.stat;
        var inputStream;

        if (process.stdin.isTTY && !inputFile && !outputFile) {
            this.showHelp();
            return;
        }

        if (!inputFile) {
            inputFile = '<stdin>';
            inputStream = process.stdin;
        } else {
            inputFile = path.resolve(process.cwd(), inputFile);
            inputStream = fs.createReadStream(inputFile);
        }

        if (outputFile) {
            outputFile = path.resolve(process.cwd(), outputFile);
        }

        if (usageFile) {
            if (!fs.existsSync(usageFile)) {
                console.error('Usage data file doesn\'t found (%s)', usageFile);
                process.exit(2);
            }

            usageData = fs.readFileSync(usageFile, 'utf-8');

            try {
                usageData = JSON.parse(usageData);
            } catch (e) {
                console.error('Usage data parse error (%s)', usageFile);
                process.exit(2);
            }
        }

        readFromStream(inputStream, function(source) {
            var time = process.hrtime();
            var mem = process.memoryUsage().heapUsed;
            var sourceMap = resolveSourceMap(source, inputMap, map, inputFile, outputFile);
            var sourceMapAnnotation = '';
            var result;

            // main action
            try {
                result = csso.minify(source, {
                    filename: inputFile,
                    sourceMap: sourceMap.output,
                    usage: usageData,
                    restructure: !structureOptimisationOff,
                    comments: comments,
                    debug: debug
                });

                // for backward capability minify returns a string
                if (typeof result === 'string') {
                    result = {
                        css: result,
                        map: null
                    };
                }
            } catch (e) {
                if (e.parseError) {
                    showParseError(source, inputFile, e.parseError, e.message);
                    if (!debug) {
                        process.exit(2);
                    }
                }

                throw e;
            }

            if (sourceMap.output && result.map) {
                // apply input map
                if (sourceMap.input) {
                    result.map.applySourceMap(
                        new SourceMapConsumer(sourceMap.input),
                        inputFile
                    );
                }

                // add source map to result
                if (sourceMap.outputFile) {
                    // write source map to file
                    fs.writeFileSync(sourceMap.outputFile, result.map.toString(), 'utf-8');
                    sourceMapAnnotation = '\n' +
                        '/*# sourceMappingURL=' +
                        path.relative(outputFile ? path.dirname(outputFile) : process.cwd(), sourceMap.outputFile) +
                        ' */';
                } else {
                    // inline source map
                    sourceMapAnnotation = '\n' +
                        '/*# sourceMappingURL=data:application/json;base64,' +
                        new Buffer(result.map.toString()).toString('base64') +
                        ' */';
                }

                result.css += sourceMapAnnotation;
            }

            // output result
            if (outputFile) {
                fs.writeFileSync(outputFile, result.css, 'utf-8');
            } else {
                console.log(result.css);
            }

            // output statistics
            if (statistics) {
                var timeDiff = process.hrtime(time);
                showStat(
                    path.relative(process.cwd(), inputFile),
                    source.length,
                    result.css.length,
                    sourceMap.inputFile,
                    sourceMapAnnotation.length,
                    parseInt(timeDiff[0] * 1e3 + timeDiff[1] / 1e6),
                    process.memoryUsage().heapUsed - mem
                );
            }
        });
    });

module.exports = {
    run: command.run.bind(command),
    isCliError: function(err) {
        return err instanceof cli.Error;
    }
};

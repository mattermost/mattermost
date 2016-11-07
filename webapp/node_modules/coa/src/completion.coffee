###*
Most of the code adopted from the npm package shell completion code.
See https://github.com/isaacs/npm/blob/master/lib/completion.js
###

Q = require 'q'
escape = require('./shell').escape
unescape = require('./shell').unescape

module.exports = ->
    @title('Shell completion')
        .helpful()
        .arg()
            .name('raw')
            .title('Completion words')
            .arr()
            .end()
        .act (opts, args) ->
            if process.platform == 'win32'
                e = new Error 'shell completion not supported on windows'
                e.code = 'ENOTSUP'
                e.errno = require('constants').ENOTSUP
                return @reject(e)

            # if the COMP_* isn't in the env, then just dump the script
            if !process.env.COMP_CWORD? or !process.env.COMP_LINE? or !process.env.COMP_POINT?
                return dumpScript(@_cmd._name)

            console.error 'COMP_LINE:  %s', process.env.COMP_LINE
            console.error 'COMP_CWORD: %s', process.env.COMP_CWORD
            console.error 'COMP_POINT: %s', process.env.COMP_POINT
            console.error 'args: %j', args.raw

            # completion opts
            opts = getOpts args.raw

            # cmd
            { cmd, argv } = @_cmd._parseCmd opts.partialWords
            Q.when complete(cmd, opts), (compls) ->
                console.error 'filtered: %j', compls
                console.log compls.map(escape).join('\n')


dumpScript = (name) ->
    fs = require 'fs'
    path = require 'path'
    defer = Q.defer()

    fs.readFile path.resolve(__dirname, 'completion.sh'), 'utf8', (err, d) ->
        if err then return defer.reject err
        d = d.replace(/{{cmd}}/g, path.basename name).replace(/^\#\!.*?\n/, '')

        onError = (err) ->
            # Darwin is a real dick sometimes.
            #
            # This is necessary because the "source" or "." program in
            # bash on OS X closes its file argument before reading
            # from it, meaning that you get exactly 1 write, which will
            # work most of the time, and will always raise an EPIPE.
            #
            # Really, one should not be tossing away EPIPE errors, or any
            # errors, so casually. But, without this, `. <(cmd completion)`
            # can never ever work on OS X.
            if err.errno == require('constants').EPIPE
                process.stdout.removeListener 'error', onError
                defer.resolve()
            else
                defer.reject(err)

        process.stdout.on 'error', onError
        process.stdout.write d, -> defer.resolve()

    defer.promise


getOpts = (argv) ->
    # get the partial line and partial word, if the point isn't at the end
    # ie, tabbing at: cmd foo b|ar
    line = process.env.COMP_LINE
    w = +process.env.COMP_CWORD
    point = +process.env.COMP_POINT
    words = argv.map unescape
    word = words[w]
    partialLine = line.substr 0, point
    partialWords = words.slice 0, w

    # figure out where in that last word the point is
    partialWord = argv[w] or ''
    i = partialWord.length
    while partialWord.substr(0, i) isnt partialLine.substr(-1 * i) and i > 0
        i--
    partialWord = unescape partialWord.substr 0, i
    if partialWord then partialWords.push partialWord

    {
        line: line
        w: w
        point: point
        words: words
        word: word
        partialLine: partialLine
        partialWords: partialWords
        partialWord: partialWord
    }


complete = (cmd, opts) ->
    compls = []

    # complete on cmds
    if opts.partialWord.indexOf('-')
        compls = Object.keys(cmd._cmdsByName)
        # Complete on required opts without '-' in last partial word
        # (if required not already specified)
        #
        # Commented out because of uselessness:
        # -b, --block suggest results in '-' on cmd line;
        # next completion suggest all options, because of '-'
        #.concat Object.keys(cmd._optsByKey).filter (v) -> cmd._optsByKey[v]._req
    else
        # complete on opt values: --opt=| case
        if m = opts.partialWord.match /^(--\w[\w-_]*)=(.*)$/
            optWord = m[1]
            optPrefix = optWord + '='
        else
            # complete on opts
            # don't complete on opts in case of --opt=val completion
            # TODO: don't complete on opts in case of unknown arg after commands
            # TODO: complete only on opts with arr() or not already used
            # TODO: complete only on full opts?
            compls = Object.keys cmd._optsByKey

    # complete on opt values: next arg case
    if not (o = opts.partialWords[opts.w - 1]).indexOf '-'
        optWord = o

    # complete on opt values: completion
    if optWord and opt = cmd._optsByKey[optWord]
        if not opt._flag and opt._comp
            compls = Q.join compls, Q.when opt._comp(opts), (c, o) ->
                c.concat o.map (v) -> (optPrefix or '') + v

    # TODO: complete on args values (context aware, custom completion?)

    # custom completion on cmds
    if cmd._comp
        compls = Q.join compls, Q.when(cmd._comp(opts)), (c, o) ->
            c.concat o

    # TODO: context aware custom completion on cmds, opts and args
    # (can depend on already entered values, especially options)

    Q.when compls, (compls) ->
        console.error 'partialWord: %s', opts.partialWord
        console.error 'compls: %j', compls
        compls.filter (c) -> c.indexOf(opts.partialWord) is 0

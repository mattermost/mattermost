UTIL = require 'util'
PATH = require 'path'
Color = require('./color').Color
Q = require('q')

#inspect = require('eyes').inspector { maxLength: 99999, stream: process.stderr }

###*
Command

Top level entity. Commands may have options and arguments.
@namespace
@class Presents command
###
exports.Cmd = class Cmd

    ###*
    @constructs
    @param {COA.Cmd} [cmd] parent command
    ###
    constructor: (cmd) ->
        if this not instanceof Cmd
            return new Cmd cmd

        @_parent cmd

        @_cmds = []
        @_cmdsByName = {}

        @_opts = []
        @_optsByKey = {}

        @_args = []

        @_ext = false

    @get: (propertyName, func) ->
        Object.defineProperty @::, propertyName,
            configurable: true
            enumerable: true
            get: func

    ###*
    Returns object containing all its subcommands as methods
    to use from other programs.
    @returns {Object}
    ###
    @get 'api', () ->
        if not @_api
            @_api = => @invoke.apply @, arguments
        for c of @_cmdsByName
            do (c) =>
                @_api[c] = @_cmdsByName[c].api
        @_api

    _parent: (cmd) ->
        @_cmd = cmd or this
        if cmd
            cmd._cmds.push @
            if @_name then @_cmd._cmdsByName[@_name] = @
        @

    ###*
    Set a canonical command identifier to be used anywhere in the API.
    @param {String} _name command name
    @returns {COA.Cmd} this instance (for chainability)
    ###
    name: (@_name) ->
        if @_cmd isnt @ then @_cmd._cmdsByName[_name] = @
        @

    ###*
    Set a long description for command to be used anywhere in text messages.
    @param {String} _title command title
    @returns {COA.Cmd} this instance (for chainability)
    ###
    title: (@_title) -> @

    ###*
    Create new or add existing subcommand for current command.
    @param {COA.Cmd} [cmd] existing command instance
    @returns {COA.Cmd} new subcommand instance
    ###
    cmd: (cmd) ->
        if cmd then cmd._parent @
        else new Cmd @

    ###*
    Create option for current command.
    @returns {COA.Opt} new option instance
    ###
    opt: -> new (require('./opt').Opt) @

    ###*
    Create argument for current command.
    @returns {COA.Opt} new argument instance
    ###
    arg: -> new (require('./arg').Arg) @

    ###*
    Add (or set) action for current command.
    @param {Function} act action function,
        invoked in the context of command instance
        and has the parameters:
            - {Object} opts parsed options
            - {Array} args parsed arguments
            - {Object} res actions result accumulator
        It can return rejected promise by Cmd.reject (in case of error)
        or any other value treated as result.
    @param {Boolean} [force=false] flag for set action instead add to existings
    @returns {COA.Cmd} this instance (for chainability)
    ###
    act: (act, force) ->
        return @ unless act

        if not force and @_act
            @_act.push act
        else
            @_act = [act]

        @

    ###*
    Set custom additional completion for current command.
    @param {Function} completion generation function,
        invoked in the context of command instance.
        Accepts parameters:
            - {Object} opts completion options
        It can return promise or any other value treated as result.
    @returns {COA.Cmd} this instance (for chainability)
    ###
    comp: (@_comp) -> @

    ###*
    Apply function with arguments in context of command instance.
    @param {Function} fn
    @param {Array} args
    @returns {COA.Cmd} this instance (for chainability)
    ###
    apply: (fn, args...) ->
        fn.apply this, args
        @

    ###*
    Make command "helpful", i.e. add -h --help flags for print usage.
    @returns {COA.Cmd} this instance (for chainability)
    ###
    helpful: ->
        @opt()
            .name('help').title('Help')
            .short('h').long('help')
            .flag()
            .only()
            .act ->
                return @usage()
            .end()

    ###*
    Adds shell completion to command, adds "completion" subcommand,
    that makes all the magic.
    Must be called only on root command.
    @returns {COA.Cmd} this instance (for chainability)
    ###
    completable: ->
        @cmd()
            .name('completion')
            .apply(require './completion')
            .end()

    ###*
    Allow command to be extendable by external node.js modules.
    @param {String} [pattern]  Pattern of node.js module to find subcommands at.
    @returns {COA.Cmd} this instance (for chainability)
    ###
    extendable: (pattern) ->
        @_ext = pattern or true
        @

    _exit: (msg, code) ->
        process.once 'exit', ->
            if msg then console.error msg
            process.exit code or 0

    ###*
    Build full usage text for current command instance.
    @returns {String} usage text
    ###
    usage: ->
        res = []

        if @_title then res.push @_fullTitle()

        res.push('', 'Usage:')

        if @_cmds.length then res.push(['', '',
            Color('lred', @_fullName()),
            Color('lblue', 'COMMAND'),
            Color('lgreen', '[OPTIONS]'),
            Color('lpurple', '[ARGS]')].join ' ')

        if @_opts.length + @_args.length then res.push(['', '',
            Color('lred', @_fullName()),
            Color('lgreen', '[OPTIONS]'),
            Color('lpurple', '[ARGS]')].join ' ')

        res.push(
            @_usages(@_cmds, 'Commands'),
            @_usages(@_opts, 'Options'),
            @_usages(@_args, 'Arguments'))

        res.join '\n'

    _usage: ->
        Color('lblue', @_name) + ' : ' + @_title

    _usages: (os, title) ->
        unless os.length then return
        res = ['', title + ':']
        for o in os
            res.push '  ' + o._usage()
        res.join '\n'

    _fullTitle: ->
        (if @_cmd is this then '' else @_cmd._fullTitle() + '\n') + @_title

    _fullName: ->
        (if this._cmd is this then '' else @_cmd._fullName() + ' ') + PATH.basename(@_name)

    _ejectOpt: (opts, opt) ->
        if (pos = opts.indexOf(opt)) >= 0
            if opts[pos]._arr
                opts[pos]
            else
                opts.splice(pos, 1)[0]

    _checkRequired: (opts, args) ->
        if not (@_opts.filter (o) -> o._only and o._name of opts).length
            all = @_opts.concat @_args
            while i = all.shift()
                if i._req and i._checkParsed opts, args
                    return @reject i._requiredText()

    _parseCmd: (argv, unparsed = []) ->
        argv = argv.concat()
        optSeen = false
        while i = argv.shift()
            if not i.indexOf '-'
                optSeen = true
            if not optSeen and /^\w[\w-_]*$/.test(i)
                cmd = @_cmdsByName[i]

                if not cmd and @_ext
                    # construct package name to require
                    if typeof @_ext is 'string'
                        if ~@_ext.indexOf('%s')
                            # use formatted string
                            pkg = UTIL.format(@_ext, i)
                        else
                            # just append subcommand name to the prefix
                            pkg = @_ext + i
                    else if @_ext is true
                        # use default scheme: <command>-<subcommand>-<subcommand> and so on
                        pkg = i
                        c = @
                        loop
                            pkg = c._name + '-' + pkg
                            if c._cmd is c then break
                            c = c._cmd

                    try
                        cmdDesc = require(pkg)
                    catch e

                    if cmdDesc
                        if typeof cmdDesc == 'function'
                            # set create subcommand, set its name and apply imported function
                            @cmd()
                                .name(i)
                                .apply(cmdDesc)
                                .end()
                        else if typeof cmdDesc == 'object'
                            # register subcommand
                            @cmd(cmdDesc)
                            # set command name
                            cmdDesc.name(i)
                        else
                            throw new Error 'Error: Unsupported command declaration type, ' +
                                'should be function or COA.Cmd() object'
                        cmd = @_cmdsByName[i]
                if cmd
                    return cmd._parseCmd argv, unparsed

            unparsed.push i

        { cmd: @, argv: unparsed }

    _parseOptsAndArgs: (argv) ->
        opts = {}
        args = {}

        nonParsedOpts = @_opts.concat()
        nonParsedArgs = @_args.concat()

        while i = argv.shift()
            # opt
            if i isnt '--' and not i.indexOf '-'

                if m = i.match /^(--\w[\w-_]*)=(.*)$/
                    i = m[1]

                    # suppress 'unknown argument' error for flag options with values
                    if not @_optsByKey[i]._flag
                        argv.unshift m[2]

                if opt = @_ejectOpt nonParsedOpts, @_optsByKey[i]
                    if Q.isRejected(res = opt._parse argv, opts)
                        return res
                else
                    return @reject "Unknown option: #{ i }"

            # arg
            else
                if i is '--'
                    i = argv.splice(0)

                i = if Array.isArray(i) then i else [i]

                while a = i.shift()
                    if arg = nonParsedArgs.shift()
                        if arg._arr then nonParsedArgs.unshift arg
                        if Q.isRejected(res = arg._parse a, args)
                            return res
                    else
                        return @reject "Unknown argument: #{ a }"

        # set defaults
        {
            opts: @_setDefaults(opts, nonParsedOpts),
            args: @_setDefaults(args, nonParsedArgs)
        }

    _setDefaults: (params, desc) ->
        for i in desc
            if i._name not of params and '_def' of i
                i._saveVal params, i._def
        params

    _processParams: (params, desc) ->
        notExists = []
        for i in desc
            n = i._name
            if n not of params
                notExists.push i
                continue

            vals = params[n]
            delete params[n]
            if not Array.isArray vals
                vals = [vals]

            for v in vals
                if Q.isRejected(res = i._saveVal(params, v))
                    return res

        # set defaults
        @_setDefaults params, notExists

    _parseArr: (argv) ->
        Q.when @_parseCmd(argv), (p) ->
            Q.when p.cmd._parseOptsAndArgs(p.argv), (r) ->
                { cmd: p.cmd, opts: r.opts, args: r.args }

    _do: (input) ->
        Q.when input, (input) =>
            cmd = input.cmd
            [@_checkRequired].concat(cmd._act or []).reduce(
                (res, act) ->
                    Q.when res, (res) ->
                        act.call(
                            cmd
                            input.opts
                            input.args
                            res)
                undefined
            )

    ###*
    Parse arguments from simple format like NodeJS process.argv
    and run ahead current program, i.e. call process.exit when all actions done.
    @param {Array} argv
    @returns {COA.Cmd} this instance (for chainability)
    ###
    run: (argv = process.argv.slice(2)) ->
        cb = (code) => (res) =>
            if res
                @_exit res.stack ? res.toString(), res.exitCode ? code
            else
                @_exit()
        Q.when(@do(argv), cb(0), cb(1)).done()
        @

    ###*
    Convenient function to run command from tests.
    @param {Array} argv
    @returns {Q.Promise}
    ###
    do: (argv) ->
        @_do(@_parseArr argv || [])

    ###*
    Invoke specified (or current) command using provided
    options and arguments.
    @param {String|Array} cmds  subcommand to invoke (optional)
    @param {Object} opts  command options (optional)
    @param {Object} args  command arguments (optional)
    @returns {Q.Promise}
    ###
    invoke: (cmds = [], opts = {}, args = {}) ->
        if typeof cmds == 'string'
            cmds = cmds.split(' ')

        if arguments.length < 3
            if not Array.isArray cmds
                args = opts
                opts = cmds
                cmds = []

        Q.when @_parseCmd(cmds), (p) =>
            if p.argv.length
                return @reject "Unknown command: " + cmds.join ' '

            Q.all([@_processParams(opts, @_opts), @_processParams(args, @_args)])
                .spread (opts, args) =>
                    @_do({ cmd: p.cmd, opts: opts, args: args })
                        # catch fails from .only() options
                        .fail (res) =>
                            if res and res.exitCode is 0
                                res.toString()
                            else
                                @reject(res)

    ###*
    Return reject of actions results promise with error code.
    Use in .act() for return with error.
    @param {Object} reject reason
        You can customize toString() method and exitCode property
        of reason object.
    @returns {Q.promise} rejected promise
    ###
    reject: (reason) -> Q.reject(reason)

    ###*
    Finish chain for current subcommand and return parent command instance.
    @returns {COA.Cmd} parent command
    ###
    end: -> @_cmd

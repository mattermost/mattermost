fs = require 'fs'
Q = require 'q'
Color = require('./color').Color
Cmd = require('./cmd').Cmd

###*
Option

Named entity. Options may have short and long keys for use from command line.
@namespace
@class Presents option
###
exports.Opt = class Opt

    ###*
    @constructs
    @param {COA.Cmd} cmd parent command
    ###
    constructor: (@_cmd) -> @_cmd._opts.push @

    ###*
    Set a canonical option identifier to be used anywhere in the API.
    @param {String} _name option name
    @returns {COA.Opt} this instance (for chainability)
    ###
    name: (@_name) -> @

    ###*
    Set a long description for option to be used anywhere in text messages.
    @param {String} _title option title
    @returns {COA.Opt} this instance (for chainability)
    ###
    title: Cmd::title

    ###*
    Set a short key for option to be used with one hyphen from command line.
    @param {String} _short
    @returns {COA.Opt} this instance (for chainability)
    ###
    short: (@_short) -> @_cmd._optsByKey['-' + _short] = @

    ###*
    Set a short key for option to be used with double hyphens from command line.
    @param {String} _long
    @returns {COA.Opt} this instance (for chainability)
    ###
    long: (@_long) -> @_cmd._optsByKey['--' + _long] = @

    ###*
    Make an option boolean, i.e. option without value.
    @returns {COA.Opt} this instance (for chainability)
    ###
    flag: () ->
        @_flag = true
        @

    ###*
    Makes an option accepts multiple values.
    Otherwise, the value will be used by the latter passed.
    @returns {COA.Opt} this instance (for chainability)
    ###
    arr: ->
        @_arr = true
        @

    ###*
    Makes an option required.
    @returns {COA.Opt} this instance (for chainability)
    ###
    req: ->
        @_req = true
        @

    ###*
    Makes an option to act as a command,
    i.e. program will exit just after option action.
    @returns {COA.Opt} this instance (for chainability)
    ###
    only: ->
        @_only = true
        @

    ###*
    Set a validation (or value) function for option.
    Value from command line passes through before becoming available from API.
    Using for validation and convertion simple types to any values.
    @param {Function} _val validating function,
        invoked in the context of option instance
        and has one parameter with value from command line
    @returns {COA.Opt} this instance (for chainability)
    ###
    val: (@_val) -> @

    ###*
    Set a default value for option.
    Default value passed through validation function as ordinary value.
    @param {Object} _def
    @returns {COA.Opt} this instance (for chainability)
    ###
    def: (@_def) -> @

    ###*
    Make option value inputting stream.
    It's add useful validation and shortcut for STDIN.
    @returns {COA.Opt} this instance (for chainability)
    ###
    input: ->
        # XXX: hack to workaround a bug in node 0.6.x,
        # see https://github.com/joyent/node/issues/2130
        process.stdin.pause();

        @
            .def(process.stdin)
            .val (v) ->
                if typeof v is 'string'
                    if v is '-'
                        process.stdin
                    else
                        s = fs.createReadStream v, { encoding: 'utf8' }
                        s.pause()
                        s
                else v

    ###*
    Make option value outputing stream.
    It's add useful validation and shortcut for STDOUT.
    @returns {COA.Opt} this instance (for chainability)
    ###
    output: ->
        @
            .def(process.stdout)
            .val (v) ->
                if typeof v is 'string'
                    if v is '-'
                        process.stdout
                    else
                        fs.createWriteStream v, { encoding: 'utf8' }
                else v

    ###*
    Add action for current option command.
    This action is performed if the current option
    is present in parsed options (with any value).
    @param {Function} act action function,
        invoked in the context of command instance
        and has the parameters:
            - {Object} opts parsed options
            - {Array} args parsed arguments
            - {Object} res actions result accumulator
        It can return rejected promise by Cmd.reject (in case of error)
        or any other value treated as result.
    @returns {COA.Opt} this instance (for chainability)
    ###
    act: (act) ->
        opt = @
        name = @_name
        @_cmd.act (opts) ->
            if name of opts
                res = act.apply @, arguments
                if opt._only
                    Q.when res, (res) =>
                        @reject {
                            toString: -> res.toString()
                            exitCode: 0
                        }
                else
                    res
        @

    ###*
    Set custom additional completion for current option.
    @param {Function} completion generation function,
        invoked in the context of option instance.
        Accepts parameters:
            - {Object} opts completion options
        It can return promise or any other value treated as result.
    @returns {COA.Opt} this instance (for chainability)
    ###
    comp: Cmd::comp

    _saveVal: (opts, val) ->
        if @_val then val = @_val val
        if @_arr
            (opts[@_name] or= []).push val
        else
            opts[@_name] = val
        val

    _parse: (argv, opts) ->
        @_saveVal(
            opts,
            if @_flag
                true
            else
                argv.shift()
        )

    _checkParsed: (opts, args) -> not opts.hasOwnProperty @_name

    _usage: ->
        res = []
        nameStr = @_name.toUpperCase()

        if @_short
            res.push '-', Color 'lgreen', @_short
            unless @_flag then res.push ' ' + nameStr
            res.push ', '

        if @_long
            res.push '--', Color 'green', @_long
            unless @_flag then res.push '=' + nameStr

        res.push ' : ', @_title

        if @_req then res.push ' ', Color('lred', '(required)')

        res.join ''

    _requiredText: -> 'Missing required option:\n  ' + @_usage()

    ###*
    Return rejected promise with error code.
    Use in .val() for return with error.
    @param {Object} reject reason
        You can customize toString() method and exitCode property
        of reason object.
    @returns {Q.promise} rejected promise
    ###
    reject: Cmd::reject

    ###*
    Finish chain for current option and return parent command instance.
    @returns {COA.Cmd} parent command
    ###
    end: Cmd::end

    ###*
    Apply function with arguments in context of option instance.
    @param {Function} fn
    @param {Array} args
    @returns {COA.Opt} this instance (for chainability)
    ###
    apply: Cmd::apply

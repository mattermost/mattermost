Color = require('./color').Color
Cmd = require('./cmd').Cmd
Opt = require('./opt').Opt

###*
Argument

Unnamed entity. From command line arguments passed as list of unnamed values.
@namespace
@class Presents argument
###
exports.Arg = class Arg

    ###*
    @constructs
    @param {COA.Cmd} cmd parent command
    ###
    constructor: (@_cmd) -> @_cmd._args.push @

    ###*
    Set a canonical argument identifier to be used anywhere in text messages.
    @param {String} _name argument name
    @returns {COA.Arg} this instance (for chainability)
    ###
    name: Opt::name

    ###*
    Set a long description for argument to be used anywhere in text messages.
    @param {String} _title argument title
    @returns {COA.Arg} this instance (for chainability)
    ###
    title: Cmd::title

    ###*
    Makes an argument accepts multiple values.
    Otherwise, the value will be used by the latter passed.
    @returns {COA.Arg} this instance (for chainability)
    ###
    arr: Opt::arr

    ###*
    Makes an argument required.
    @returns {COA.Arg} this instance (for chainability)
    ###
    req: Opt::req

    ###*
    Set a validation (or value) function for argument.
    Value from command line passes through before becoming available from API.
    Using for validation and convertion simple types to any values.
    @param {Function} _val validating function,
        invoked in the context of argument instance
        and has one parameter with value from command line
    @returns {COA.Arg} this instance (for chainability)
    ###
    val: Opt::val

    ###*
    Set a default value for argument.
    Default value passed through validation function as ordinary value.
    @param {Object} _def
    @returns {COA.Arg} this instance (for chainability)
    ###
    def: Opt::def

    ###*
    Set custom additional completion for current argument.
    @param {Function} completion generation function,
        invoked in the context of argument instance.
        Accepts parameters:
            - {Object} opts completion options
        It can return promise or any other value treated as result.
    @returns {COA.Arg} this instance (for chainability)
    ###
    comp: Cmd::comp

    ###*
    Make argument value inputting stream.
    It's add useful validation and shortcut for STDIN.
    @returns {COA.Arg} this instance (for chainability)
    ###
    input: Opt::input

    ###*
    Make argument value outputing stream.
    It's add useful validation and shortcut for STDOUT.
    @returns {COA.Arg} this instance (for chainability)
    ###
    output: Opt::output

    _parse: (arg, args) ->
        @_saveVal(args, arg)

    _saveVal: Opt::_saveVal

    _checkParsed: (opts, args) -> not args.hasOwnProperty(@_name)

    _usage: ->
        res = []

        res.push Color('lpurple', @_name.toUpperCase()), ' : ', @_title
        if @_req then res.push ' ', Color('lred', '(required)')

        res.join ''

    _requiredText: -> 'Missing required argument:\n  ' + @_usage()

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
    Apply function with arguments in context of arg instance.
    @param {Function} fn
    @param {Array} args
    @returns {COA.Arg} this instance (for chainability)
    ###
    apply: Cmd::apply

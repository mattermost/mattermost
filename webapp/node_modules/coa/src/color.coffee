colors =
    black: '30'
    dgray: '1;30'
    red: '31'
    lred: '1;31'
    green: '32'
    lgreen: '1;32'
    brown: '33'
    yellow: '1;33'
    blue: '34'
    lblue: '1;34'
    purple: '35'
    lpurple: '1;35'
    cyan: '36'
    lcyan: '1;36'
    lgray: '37'
    white: '1;37'

exports.Color = (c, str) ->
    # Use \x1B instead of \033 because of CoffeeScript 1.3.x compilation error
    [
        '\x1B[', colors[c], 'm'
        str
        '\x1B[m'
    ].join ''

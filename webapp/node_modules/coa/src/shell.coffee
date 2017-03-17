exports.unescape = (w) ->
    w = if w.charAt(0) is '"'
        w.replace(/^"|([^\\])"$/g, '$1')
    else
        w.replace(/\\ /g, ' ')
    w.replace(/\\("|'|\$|`|\\)/g, '$1')

exports.escape = (w) ->
    w = w.replace(/(["'$`\\])/g,'\\$1')
    if w.match(/\s+/) then '"' + w + '"' else w

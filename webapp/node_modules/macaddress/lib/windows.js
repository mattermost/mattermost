var exec = require('child_process').exec;

var regexRegex = /[-\/\\^$*+?.()|[\]{}]/g;

function escape(string) {
    return string.replace(regexRegex, '\\$&');
}

module.exports = function (iface, callback) {
    exec("ipconfig /all", function (err, out) {
        if (err) {
            callback(err, null);
            return;
        }
        var match = new RegExp(escape(iface)).exec(out);
        if (!match) {
            callback("did not find interface in `ipconfig /all`", null);
            return;
        }
        out = out.substring(match.index + iface.length);
        match = /[A-Fa-f0-9]{2}(\-[A-Fa-f0-9]{2}){5}/.exec(out);
        if (!match) {
            callback("did not find a mac address", null);
            return;
        }
        callback(null, match[0].toLowerCase().replace(/\-/g, ':'));
    });
};

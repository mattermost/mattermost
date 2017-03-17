var minus = '-'.charCodeAt(0);
var plus  = '+'.charCodeAt(0);
var dot   = '.'.charCodeAt(0);

module.exports = function (value) {
    var pos = 0;
    var length = value.length;
    var dotted = false;
    var containsNumber = false;
    var code;
    var number = '';

    while (pos < length) {
        code = value.charCodeAt(pos);

        if (code >= 48 && code <= 57) {
            number += value[pos];
            containsNumber = true;
        } else if (code === dot) {
            if (dotted) {
                break;
            }
            dotted = true;
            number += value[pos];
        } else if (code === plus || code === minus) {
            if (pos !== 0) {
                break;
            }
            number += value[pos];
        } else {
            break;
        }

        pos += 1;
    }

    return containsNumber ? {
        number: number,
        unit: value.slice(pos)
    } : false;
};

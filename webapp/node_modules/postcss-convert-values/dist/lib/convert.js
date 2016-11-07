'use strict';

exports.__esModule = true;

exports.default = function (number, unit, _ref) {
    var time = _ref.time;
    var length = _ref.length;
    var angle = _ref.angle;

    var value = dropLeadingZero(number) + (unit ? unit : '');
    var converted = void 0;

    if (length !== false && unit in lengthConv) {
        converted = transform(number, unit, lengthConv);
    }

    if (time !== false && unit in timeConv) {
        converted = transform(number, unit, timeConv);
    }

    if (angle !== false && unit in angleConv) {
        converted = transform(number, unit, angleConv);
    }

    if (converted && converted.length < value.length) {
        value = converted;
    }

    return value;
};

var lengthConv = {
    in: 96,
    px: 1,
    pt: 4 / 3,
    pc: 16
};

var timeConv = {
    s: 1000,
    ms: 1
};

var angleConv = {
    turn: 360,
    deg: 1
};

function dropLeadingZero(number) {
    var value = String(number);

    if (number % 1) {
        if (value[0] === '0') {
            return value.slice(1);
        }

        if (value[0] === '-' && value[1] === '0') {
            return '-' + value.slice(2);
        }
    }

    return value;
}

function transform(number, unit, conversion) {
    var one = void 0,
        base = void 0;
    var convertionUnits = Object.keys(conversion).filter(function (u) {
        if (conversion[u] === 1) {
            one = u;
        }
        return unit !== u;
    });

    if (unit === one) {
        base = number / conversion[unit];
    } else {
        base = number * conversion[unit];
    }

    return convertionUnits.map(function (u) {
        return dropLeadingZero(base / conversion[u]) + u;
    }).reduce(function (a, b) {
        return a.length < b.length ? a : b;
    });
}

module.exports = exports['default'];
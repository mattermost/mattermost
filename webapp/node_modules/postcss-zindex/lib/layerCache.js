'use strict';

var uniq = require('uniqs');

function LayerCache () {
    if (!(this instanceof LayerCache)) {
        return new LayerCache();
    }
    this._values = [];
}

function sortAscending (a, b) {
    return a - b;
}

function mapValues (value, index) {
    return {
        from: value,
        to: index + 1
    };
}

LayerCache.prototype._findValue = function (value) {
    var length = this._values.length;
    for (var i = 0; i < length; ++i) {
        if (this._values[i].from === value) {
            return this._values[i];
        }
    }
    return false;
};

LayerCache.prototype.optimizeValues = function () {
    var values = uniq(this._values)
        .sort(sortAscending)
        .map(mapValues);

    this._values = values;
};

LayerCache.prototype.addValue = function (value) {
    var parsedValue = parseInt(value, 10);
    // pass only valid values
    if (!parsedValue || parsedValue < 0) {
        return;
    }
    this._values.push(parsedValue);
};

LayerCache.prototype.getValue = function (value) {
    var parsedValue = parseInt(value, 10);
    var match = this._findValue(parsedValue);
    return match && match.to || value;
};

module.exports = LayerCache;

"use strict";

exports.__esModule = true;
exports.default = getMatchFactory;
function getMatchFactory(mappings) {
    return function getMatch(args) {
        return args.reduce(function (list, arg, i) {
            return list.filter(function (keyword) {
                return keyword[1][i] === arg;
            });
        }, mappings);
    };
}
module.exports = exports["default"];
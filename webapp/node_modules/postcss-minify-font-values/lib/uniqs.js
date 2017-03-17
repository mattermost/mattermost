module.exports = function uniqueExcept (exclude) {
    return function unique () {
        var list = Array.prototype.concat.apply([], arguments);
        return list.filter(function (item, i) {
            if (item === exclude) {
                return true;
            }
            return i === list.indexOf(item);
        });
    };
};

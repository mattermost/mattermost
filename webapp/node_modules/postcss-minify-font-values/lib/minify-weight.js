module.exports = function (value) {
    return value === 'normal' ? '400' : value === 'bold' ? '700' : value;
};

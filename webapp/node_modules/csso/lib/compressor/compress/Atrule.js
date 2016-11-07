var resolveKeyword = require('../../utils/names.js').keyword;
var compressKeyframes = require('./atrule/keyframes.js');

module.exports = function(node) {
    // compress @keyframe selectors
    if (resolveKeyword(node.name).name === 'keyframes') {
        compressKeyframes(node);
    }
};

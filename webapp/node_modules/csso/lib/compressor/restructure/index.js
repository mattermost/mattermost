var prepare = require('./prepare/index.js');
var initialMergeRuleset = require('./1-initialMergeRuleset.js');
var mergeAtrule = require('./2-mergeAtrule.js');
var disjoinRuleset = require('./3-disjoinRuleset.js');
var restructShorthand = require('./4-restructShorthand.js');
var restructBlock = require('./6-restructBlock.js');
var mergeRuleset = require('./7-mergeRuleset.js');
var restructRuleset = require('./8-restructRuleset.js');

module.exports = function(ast, usageData, debug) {
    // prepare ast for restructing
    var indexer = prepare(ast, usageData);
    debug('prepare', ast);

    initialMergeRuleset(ast);
    debug('initialMergeRuleset', ast);

    mergeAtrule(ast);
    debug('mergeAtrule', ast);

    disjoinRuleset(ast);
    debug('disjoinRuleset', ast);

    restructShorthand(ast, indexer);
    debug('restructShorthand', ast);

    restructBlock(ast);
    debug('restructBlock', ast);

    mergeRuleset(ast);
    debug('mergeRuleset', ast);

    restructRuleset(ast);
    debug('restructRuleset', ast);
};

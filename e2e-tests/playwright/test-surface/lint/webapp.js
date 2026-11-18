// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import testidGrammar from './testid-grammar.js';
import testidNoUnscopedData from './testid-no-unscoped-data.js';

// The rules that read the webapp's own source. The e2e rules live in the full plugin (`./index.js`): they need
// `typescript`, which the webapp's lint job does not install next to this package, so the webapp imports this entry.
export default {
    rules: {
        'testid-grammar': testidGrammar,
        'testid-no-unscoped-data': testidNoUnscopedData,
    },
};

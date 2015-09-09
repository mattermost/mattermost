// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const Constants = require('../utils/constants.jsx');
const UserStore = require('../stores/user_store.jsx');

export function formatText(text, options = {}) {
    let output = sanitize(text);

    // TODO autolink @mentions
    // TODO highlight mentions of self
    // TODO autolink urls
    // TODO highlight search terms
    // TODO autolink hashtags

    // TODO leave space for markdown

    if (options.singleline) {
        output = output.replace('\n', ' ');
    } else {
        output = output.replace('\n', '<br />');
    }

    return output;
}

export function sanitize(text) {
    let output = text;

    // normal string.replace only does a single occurrance so use a regex instead
    output = output.replace(/&/g, '&amp;');
    output = output.replace(/</g, '&lt;');
    output = output.replace(/>/g, '&gt;');

    return output;
}

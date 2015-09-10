// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const Constants = require('./constants.jsx');
const UserStore = require('../stores/user_store.jsx');

export function formatText(text, options = {}) {
    let output = sanitize(text);

    let atMentions;
    [output, atMentions] = stripAtMentions(output);

    output = reinsertAtMentions(output, atMentions);

    output = replaceNewlines(output, options.singleline);

    return output;

    // TODO autolink @mentions
    // TODO highlight mentions of self
    // TODO autolink urls
    // TODO highlight search terms
    // TODO autolink hashtags

    // TODO leave space for markdown
}

export function sanitize(text) {
    let output = text;

    // normal string.replace only does a single occurrance so use a regex instead
    output = output.replace(/&/g, '&amp;');
    output = output.replace(/</g, '&lt;');
    output = output.replace(/>/g, '&gt;');

    return output;
}

function stripAtMentions(text) {
    let output = text;
    let atMentions = new Map();

    function stripAtMention(fullMatch, prefix, mentionText, username) {
        if (Constants.SPECIAL_MENTIONS.indexOf(username) !== -1 || UserStore.getProfileByUsername(username)) {
            const index = atMentions.size;
            const alias = `ATMENTION${index}`;

            atMentions.set(alias, {mentionText: mentionText, username: username});

            return prefix + alias;
        } else {
            return fullMatch;
        }
    }

    output = output.replace(/(^|\s)(@([a-z0-9.\-_]+))/g, stripAtMention);

    return [output, atMentions];
}
window.stripAtMentions = stripAtMentions;

function reinsertAtMentions(text, atMentions) {
    let output = text;

    function reinsertAtMention(replacement, alias) {
        output = output.replace(alias, `<a class='mention-link' href='#' data-mention=${replacement.username}>${replacement.mentionText}</a>`);
    }

    atMentions.forEach(reinsertAtMention);

    return output;
}
window.reinsertAtMentions = reinsertAtMentions;

function replaceNewlines(text, singleline) {
    if (!singleline) {
        return text.replace(/\n/g, '<br />');
    } else {
        return text.replace(/\n/g, ' ');
    }
}

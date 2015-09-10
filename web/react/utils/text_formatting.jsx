// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const Constants = require('./constants.jsx');
const UserStore = require('../stores/user_store.jsx');

export function formatText(text, options = {}) {
    let output = sanitize(text);
    let tokens = new Map();

    // TODO strip urls first

    output = stripAtMentions(output, tokens);
    output = stripSelfMentions(output, tokens);

    output = replaceTokens(output, tokens);

    output = replaceNewlines(output, options.singleline);

    return output;

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

function stripAtMentions(text, tokens) {
    let output = text;

    function stripAtMention(fullMatch, prefix, mention, username) {
        if (Constants.SPECIAL_MENTIONS.indexOf(username) !== -1 || UserStore.getProfileByUsername(username)) {
            const index = tokens.size;
            const alias = `ATMENTION${index}`;

            tokens.set(alias, {
                value: `<a class='mention-link' href='#' data-mention='${username}'>${mention}</a>`,
                originalText: mention
            });

            return prefix + alias;
        } else {
            return fullMatch;
        }
    }

    output = output.replace(/(^|\s)(@([a-z0-9.\-_]+))/gi, stripAtMention);

    return output;
}
window.stripAtMentions = stripAtMentions;

function stripSelfMentions(text, tokens) {
    let output = text;

    let mentionKeys = UserStore.getCurrentMentionKeys();

    // look for any existing tokens which are self mentions and should be highlighted
    var newTokens = new Map();
    for (let [alias, token] of tokens) {
        if (mentionKeys.indexOf(token.originalText) !== -1) {
            const index = newTokens.size;
            const newAlias = `SELFMENTION${index}`;

            newTokens.set(newAlias, {
                value: `<span class='mention-highlight'>${alias}</span>`,
                originalText: token.originalText
            });

            output = output.replace(alias, newAlias);
        }
    }

    // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
    for (let newToken of newTokens) {
        tokens.set(newToken[0], newToken[1]);
    }

    // look for self mentions in the text
    function stripSelfMention(fullMatch, prefix, mention) {
        const index = tokens.size;
        const alias = `SELFMENTION${index}`;

        tokens.set(alias, {
            value: `<span class='mention-highlight'>${mention}</span>`,
            originalText: mention
        });

        return prefix + alias;
    }

    for (let mention of UserStore.getCurrentMentionKeys()) {
        output = output.replace(new RegExp(`(^|\\W)(${mention})\\b`, 'gi'), stripSelfMention);
    }

    return output;
}

function replaceTokens(text, tokens) {
    let output = text;

    // iterate backwards through the map so that we do replacement in the opposite order that we added tokens
    const aliases = [...tokens.keys()];
    for (let i = aliases.length - 1; i >= 0; i--) {
        const alias = aliases[i];
        const token = tokens.get(alias);
        console.log('replacing ' + alias + ' with ' + token.value);
        output = output.replace(alias, token.value);
    }

    return output;
}
window.replaceTokens = replaceTokens;

function replaceNewlines(text, singleline) {
    if (!singleline) {
        return text.replace(/\n/g, '<br />');
    } else {
        return text.replace(/\n/g, ' ');
    }
}

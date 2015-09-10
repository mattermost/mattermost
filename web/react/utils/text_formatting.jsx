// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const Autolinker = require('autolinker');
const Constants = require('./constants.jsx');
const UserStore = require('../stores/user_store.jsx');

export function formatText(text, options = {}) {
    let output = sanitize(text);
    let tokens = new Map();

    output = stripLinks(output, tokens);
    output = stripAtMentions(output, tokens);
    output = stripSelfMentions(output, tokens);
    output = stripHashtags(output, tokens);

    output = replaceTokens(output, tokens);

    output = replaceNewlines(output, options.singleline);

    return output;

    // TODO highlight search terms

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

function stripLinks(text, tokens) {
    function stripLink(autolinker, match) {
        let text = match.getMatchedText();
        let url = text;
        if (!url.startsWith('http')) {
            url = `http://${text}`;
        }

        const index = tokens.size;
        const alias = `LINK${index}`;

        tokens.set(alias, {
            value: `<a class='theme' target='_blank' href='${url}'>${text}</a>`,
            originalText: text
        });

        return alias;
    }

    // we can't just use a static autolinker because we need to set replaceFn
    const autolinker = new Autolinker({
        urls: true,
        email: true,
        phone: false,
        twitter: false,
        hashtag: false,
        replaceFn: stripLink
    });

    return autolinker.link(text);
}

function stripAtMentions(text, tokens) {
    let output = text;

    function stripAtMention(fullMatch, prefix, mention, username) {
        const usernameLower = username.toLowerCase();
        if (Constants.SPECIAL_MENTIONS.indexOf(usernameLower) !== -1 || UserStore.getProfileByUsername(usernameLower)) {
            const index = tokens.size;
            const alias = `ATMENTION${index}`;

            tokens.set(alias, {
                value: `<a class='mention-link' href='#' data-mention='${usernameLower}'>${mention}</a>`,
                originalText: mention
            });

            return prefix + alias;
        } else {
            return fullMatch;
        }
    }

    output = output.replace(/(^|\s)(@([a-z0-9.\-_]*[a-z0-9]))/gi, stripAtMention);

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

function stripHashtags(text, tokens) {
    let output = text;

    var newTokens = new Map();
    for (let [alias, token] of tokens) {
        if (token.originalText.startsWith('#')) {
            const index = newTokens.size;
            const newAlias = `HASHTAG${index}`;

            newTokens.set(newAlias, {
                value: `<a class='mention-link' href='#' data-mention='${token.originalText}'>${token.originalText}</a>`,
                originalText: token.originalText
            });

            output = output.replace(alias, newAlias);
        }
    }

    // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
    for (let newToken of newTokens) {
        tokens.set(newToken[0], newToken[1]);
    }

    // look for hashtags in the text
    function stripHashtag(fullMatch, prefix, hashtag) {
        const index = tokens.size;
        const alias = `HASHTAG${index}`;

        tokens.set(alias, {
            value: `<a class='mention-link' href='#' data-mention='${hashtag}'>${hashtag}</a>`,
            originalText: hashtag
        });

        return prefix + alias;
    }

    output = output.replace(/(^|\W)(#[a-zA-Z0-9.\-_]+)\b/g, stripHashtag);

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

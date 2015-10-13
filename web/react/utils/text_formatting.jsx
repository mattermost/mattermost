// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Autolinker = require('autolinker');
const Constants = require('./constants.jsx');
const Emoticons = require('./emoticons.jsx');
const Markdown = require('./markdown.jsx');
const UserStore = require('../stores/user_store.jsx');
const Utils = require('./utils.jsx');

const marked = require('marked');

// Performs formatting of user posts including highlighting mentions and search terms and converting urls, hashtags, and
// @mentions to links by taking a user's message and returning a string of formatted html. Also takes a number of options
// as part of the second parameter:
// - searchTerm - If specified, this word is highlighted in the resulting html. Defaults to nothing.
// - mentionHighlight - Specifies whether or not to highlight mentions of the current user. Defaults to true.
// - singleline - Specifies whether or not to remove newlines. Defaults to false.
// - emoticons - Enables emoticon parsing. Defaults to true.
// - markdown - Enables markdown parsing. Defaults to true.
export function formatText(text, options = {}) {
    let output;

    if (!('markdown' in options) || options.markdown) {
        // the markdown renderer will call doFormatText as necessary so just call marked
        output = marked(text, {
            renderer: new Markdown.MattermostMarkdownRenderer(null, options),
            sanitize: true
        });
    } else {
        output = sanitizeHtml(text);
        output = doFormatText(output, options);
    }

    // replace newlines with spaces if necessary
    if (options.singleline) {
        output = replaceNewlines(output);
    }

    return output;
}

// Performs most of the actual formatting work for formatText. Not intended to be called normally.
export function doFormatText(text, options) {
    let output = text;

    const tokens = new Map();

    // replace important words and phrases with tokens
    output = autolinkUrls(output, tokens);
    output = autolinkAtMentions(output, tokens);
    output = autolinkHashtags(output, tokens);

    if (!('emoticons' in options) || options.emoticon) {
        output = Emoticons.handleEmoticons(output, tokens);
    }

    if (options.searchTerm) {
        output = highlightSearchTerm(output, tokens, options.searchTerm);
    }

    if (!('mentionHighlight' in options) || options.mentionHighlight) {
        output = highlightCurrentMentions(output, tokens);
    }

    // reinsert tokens with formatted versions of the important words and phrases
    output = replaceTokens(output, tokens);

    return output;
}

export function sanitizeHtml(text) {
    let output = text;

    // normal string.replace only does a single occurrance so use a regex instead
    output = output.replace(/&/g, '&amp;');
    output = output.replace(/</g, '&lt;');
    output = output.replace(/>/g, '&gt;');
    output = output.replace(/'/g, '&apos;');
    output = output.replace(/"/g, '&quot;');

    return output;
}

function autolinkUrls(text, tokens) {
    function replaceUrlWithToken(autolinker, match) {
        const linkText = match.getMatchedText();
        let url = linkText;

        if (match.getType() === 'email') {
            url = `mailto:${url}`;
        } else if (url.lastIndexOf('http', 0) !== 0) {
            url = `http://${url}`;
        }

        const index = tokens.size;
        const alias = `MM_LINK${index}`;

        var target = 'target="_blank"';
        if (url.lastIndexOf(Utils.getTeamURLFromAddressBar(), 0) === 0) {
            target = '';
        }

        tokens.set(alias, {
            value: `<a class="theme" ${target} href="${url}">${linkText}</a>`,
            originalText: linkText
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
        replaceFn: replaceUrlWithToken
    });

    return autolinker.link(text);
}

function autolinkAtMentions(text, tokens) {
    let output = text;

    function replaceAtMentionWithToken(fullMatch, prefix, mention, username) {
        const usernameLower = username.toLowerCase();
        if (Constants.SPECIAL_MENTIONS.indexOf(usernameLower) !== -1 || UserStore.getProfileByUsername(usernameLower)) {
            const index = tokens.size;
            const alias = `MM_ATMENTION${index}`;

            tokens.set(alias, {
                value: `<a class='mention-link' href='#' data-mention='${usernameLower}'>${mention}</a>`,
                originalText: mention
            });

            return prefix + alias;
        }

        return fullMatch;
    }

    output = output.replace(/(^|\s)(@([a-z0-9.\-_]*[a-z0-9]))/gi, replaceAtMentionWithToken);

    return output;
}

function highlightCurrentMentions(text, tokens) {
    let output = text;

    const mentionKeys = UserStore.getCurrentMentionKeys();

    // look for any existing tokens which are self mentions and should be highlighted
    var newTokens = new Map();
    for (const [alias, token] of tokens) {
        if (mentionKeys.indexOf(token.originalText) !== -1) {
            const index = tokens.size + newTokens.size;
            const newAlias = `MM_SELFMENTION${index}`;

            newTokens.set(newAlias, {
                value: `<span class='mention-highlight'>${alias}</span>`,
                originalText: token.originalText
            });

            output = output.replace(alias, newAlias);
        }
    }

    // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
    for (const newToken of newTokens) {
        tokens.set(newToken[0], newToken[1]);
    }

    // look for self mentions in the text
    function replaceCurrentMentionWithToken(fullMatch, prefix, mention) {
        const index = tokens.size;
        const alias = `MM_SELFMENTION${index}`;

        tokens.set(alias, {
            value: `<span class='mention-highlight'>${mention}</span>`,
            originalText: mention
        });

        return prefix + alias;
    }

    for (const mention of UserStore.getCurrentMentionKeys()) {
        output = output.replace(new RegExp(`(^|\\W)(${mention})\\b`, 'gi'), replaceCurrentMentionWithToken);
    }

    return output;
}

function autolinkHashtags(text, tokens) {
    let output = text;

    var newTokens = new Map();
    for (const [alias, token] of tokens) {
        if (token.originalText.lastIndexOf('#', 0) === 0) {
            const index = tokens.size + newTokens.size;
            const newAlias = `MM_HASHTAG${index}`;

            newTokens.set(newAlias, {
                value: `<a class='mention-link' href='#' data-hashtag='${token.originalText}'>${token.originalText}</a>`,
                originalText: token.originalText
            });

            output = output.replace(alias, newAlias);
        }
    }

    // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
    for (const newToken of newTokens) {
        tokens.set(newToken[0], newToken[1]);
    }

    // look for hashtags in the text
    function replaceHashtagWithToken(fullMatch, prefix, hashtag) {
        const index = tokens.size;
        const alias = `MM_HASHTAG${index}`;

        tokens.set(alias, {
            value: `<a class='mention-link' href='#' data-hashtag='${hashtag}'>${hashtag}</a>`,
            originalText: hashtag
        });

        return prefix + alias;
    }

    return output.replace(/(^|\W)(#[a-zA-Z][a-zA-Z0-9.\-_]*)\b/g, replaceHashtagWithToken);
}

function highlightSearchTerm(text, tokens, searchTerm) {
    let output = text;

    var newTokens = new Map();
    for (const [alias, token] of tokens) {
        if (token.originalText === searchTerm) {
            const index = tokens.size + newTokens.size;
            const newAlias = `MM_SEARCHTERM${index}`;

            newTokens.set(newAlias, {
                value: `<span class='search-highlight'>${alias}</span>`,
                originalText: token.originalText
            });

            output = output.replace(alias, newAlias);
        }
    }

    // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
    for (const newToken of newTokens) {
        tokens.set(newToken[0], newToken[1]);
    }

    function replaceSearchTermWithToken(fullMatch, prefix, word) {
        const index = tokens.size;
        const alias = `MM_SEARCHTERM${index}`;

        tokens.set(alias, {
            value: `<span class='search-highlight'>${word}</span>`,
            originalText: word
        });

        return prefix + alias;
    }

    return output.replace(new RegExp(`(^|\\W)(${searchTerm})\\b`, 'gi'), replaceSearchTermWithToken);
}

function replaceTokens(text, tokens) {
    let output = text;

    // iterate backwards through the map so that we do replacement in the opposite order that we added tokens
    const aliases = [...tokens.keys()];
    for (let i = aliases.length - 1; i >= 0; i--) {
        const alias = aliases[i];
        const token = tokens.get(alias);
        output = output.replace(alias, token.value);
    }

    return output;
}

function replaceNewlines(text) {
    return text.replace(/\n/g, ' ');
}

// A click handler that can be used with the results of TextFormatting.formatText to add default functionality
// to clicked hashtags and @mentions.
export function handleClick(e) {
    const mentionAttribute = e.target.getAttributeNode('data-mention');
    const hashtagAttribute = e.target.getAttributeNode('data-hashtag');

    if (mentionAttribute) {
        Utils.searchForTerm(mentionAttribute.value);
    } else if (hashtagAttribute) {
        Utils.searchForTerm(hashtagAttribute.value);
    }
}

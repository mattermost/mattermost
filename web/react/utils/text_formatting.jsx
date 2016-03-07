// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Autolinker from 'autolinker';
import Constants from './constants.jsx';
import * as Emoticons from './emoticons.jsx';
import * as Markdown from './markdown.jsx';
import UserStore from '../stores/user_store.jsx';
import * as Utils from './utils.jsx';

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
        // the markdown renderer will call doFormatText as necessary
        output = Markdown.format(text, options);
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
    output = autolinkAtMentions(output, tokens);
    output = autolinkEmails(output, tokens);
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

// Convert emails into tokens
function autolinkEmails(text, tokens) {
    function replaceEmailWithToken(autolinker, match) {
        const linkText = match.getMatchedText();
        let url = linkText;

        if (match.getType() === 'email') {
            url = `mailto:${url}`;
        }

        const index = tokens.size;
        const alias = `MM_EMAIL${index}`;

        tokens.set(alias, {
            value: `<a class="theme" href="${url}">${linkText}</a>`,
            originalText: linkText
        });

        return alias;
    }

    // we can't just use a static autolinker because we need to set replaceFn
    const autolinker = new Autolinker({
        urls: false,
        email: true,
        phone: false,
        twitter: false,
        hashtag: false,
        replaceFn: replaceEmailWithToken
    });

    return autolinker.link(text);
}

function autolinkAtMentions(text, tokens) {
    // Return true if provided character is punctuation
    function isPunctuation(character) {
        const re = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g;
        return re.test(character);
    }

    // Test if provided text needs to be highlighted, special mention or current user
    function mentionExists(u) {
        return (Constants.SPECIAL_MENTIONS.indexOf(u) !== -1 || UserStore.getProfileByUsername(u));
    }

    function addToken(username, mention) {
        const index = tokens.size;
        const alias = `MM_ATMENTION${index}`;

        tokens.set(alias, {
            value: `<a class='mention-link' href='#' data-mention='${username}'>${mention}</a>`,
            originalText: mention
        });
        return alias;
    }

    function replaceAtMentionWithToken(fullMatch, mention, username) {
        let usernameLower = username.toLowerCase();

        if (mentionExists(usernameLower)) {
            // Exact match
            const alias = addToken(usernameLower, mention, '');
            return alias;
        }

        // Not an exact match, attempt to truncate any punctuation to see if we can find a user
        const originalUsername = usernameLower;

        for (let c = usernameLower.length; c > 0; c--) {
            if (isPunctuation(usernameLower[c - 1])) {
                usernameLower = usernameLower.substring(0, c - 1);

                if (mentionExists(usernameLower)) {
                    const suffix = originalUsername.substr(c - 1);
                    const alias = addToken(usernameLower, '@' + usernameLower);
                    return alias + suffix;
                }
            } else {
                // If the last character is not punctuation, no point in going any further
                break;
            }
        }

        return fullMatch;
    }

    let output = text;
    output = output.replace(/(@([a-z0-9.\-_]*))/gi, replaceAtMentionWithToken);

    return output;
}

function escapeRegex(text) {
    return text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
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
        output = output.replace(new RegExp(`(^|\\W)(${escapeRegex(mention)})\\b`, 'gi'), replaceCurrentMentionWithToken);
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

        let value = hashtag;

        if (hashtag.length > Constants.MIN_HASHTAG_LINK_LENGTH) {
            value = `<a class='mention-link' href='#' data-hashtag='${hashtag}'>${hashtag}</a>`;
        }

        tokens.set(alias, {
            value,
            originalText: hashtag
        });

        return prefix + alias;
    }

    return output.replace(/(^|\W)(#[a-zA-ZäöüÄÖÜß][a-zA-Z0-9äöüÄÖÜß.\-_]*)\b/g, replaceHashtagWithToken);
}

const puncStart = /^[.,()&$!\[\]{}':;\\]+/;
const puncEnd = /[.,()&$#!\[\]{}':;\\]+$/;

function parseSearchTerms(searchTerm) {
    let terms = [];

    let termString = searchTerm;

    while (termString) {
        let captured;

        // check for a quoted string
        captured = (/^"(.*?)"/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);
            terms.push(captured[1]);
            continue;
        }

        // check for a search flag (and don't add it to terms)
        captured = (/^(?:in|from|channel): ?\S+/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);
            continue;
        }

        // capture any plain text up until the next quote or search flag
        captured = (/^.+?(?=\bin|\bfrom|\bchannel|"|$)/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);

            // break the text up into words based on how the server splits them in SqlPostStore.SearchPosts and then discard empty terms
            terms.push(...captured[0].split(/[ <>+\-\(\)\~\@]/).filter((term) => !!term));
            continue;
        }

        // we should never reach this point since at least one of the regexes should match something in the remaining text
        throw new Error('Infinite loop in search term parsing: ' + termString);
    }

    // remove punctuation from each term
    terms = terms.map((term) => term.replace(puncStart, '').replace(puncEnd, ''));

    return terms;
}

function convertSearchTermToRegex(term) {
    let pattern;
    if (term.endsWith('*')) {
        pattern = '\\b' + escapeRegex(term.substring(0, term.length - 1));
    } else {
        pattern = '\\b' + escapeRegex(term) + '\\b';
    }

    return new RegExp(pattern, 'gi');
}

function highlightSearchTerm(text, tokens, searchTerm) {
    const terms = parseSearchTerms(searchTerm);

    if (terms.length === 0) {
        return text;
    }

    let output = text;

    function replaceSearchTermWithToken(word) {
        const index = tokens.size;
        const alias = `MM_SEARCHTERM${index}`;

        tokens.set(alias, {
            value: `<span class='search-highlight'>${word}</span>`,
            originalText: word
        });

        return alias;
    }

    for (const term of terms) {
        // highlight existing tokens matching search terms
        var newTokens = new Map();
        for (const [alias, token] of tokens) {
            if (token.originalText === term.replace(/\*$/, '')) {
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

        output = output.replace(convertSearchTermToRegex(term), replaceSearchTermWithToken);
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

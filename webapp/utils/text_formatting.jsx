// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Autolinker from 'autolinker';
import Constants from './constants.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import * as Emoticons from './emoticons.jsx';
import * as Markdown from './markdown.jsx';
import twemoji from 'twemoji';
import XRegExp from 'xregexp';

// pattern to detect the existance of a Chinese, Japanese, or Korean character in a string
// http://stackoverflow.com/questions/15033196/using-javascript-to-check-whether-a-string-contains-japanese-characters-includi
const cjkPattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/;

// Performs formatting of user posts including highlighting mentions and search terms and converting urls, hashtags,
// @mentions and ~channels to links by taking a user's message and returning a string of formatted html. Also takes
// a number of options as part of the second parameter:
// - searchTerm - If specified, this word is highlighted in the resulting html. Defaults to nothing.
// - mentionHighlight - Specifies whether or not to highlight mentions of the current user. Defaults to true.
// - mentionKeys - A list of mention keys for the current user to highlight.
// - singleline - Specifies whether or not to remove newlines. Defaults to false.
// - emoticons - Enables emoticon parsing. Defaults to true.
// - markdown - Enables markdown parsing. Defaults to true.
// - siteURL - The origin of this Mattermost instance. If provided, links to channels and posts will be replaced with internal
//     links that can be handled by a special click handler.
// - usernameMap - An object mapping usernames to users. If provided, at mentions will be replaced with internal links that can
//      be handled by a special click handler (Utils.handleFormattedTextClick)
// - channelNamesMap - An object mapping channel display names to channels. If provided, ~channel mentions will be replaced with
//      links to the relevant channel.
// - team - The current team.
export function formatText(text, inputOptions) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let output = text;

    const options = Object.assign({}, inputOptions);
    options.searchPatterns = parseSearchTerms(options.searchTerm).map(convertSearchTermToRegex);

    if (!('markdown' in options) || options.markdown) {
        // the markdown renderer will call doFormatText as necessary
        output = Markdown.format(output, options);
    } else {
        output = sanitizeHtml(output);
        output = doFormatText(output, options);
    }

    // replace newlines with spaces if necessary
    if (options.singleline) {
        output = replaceNewlines(output);
    }

    output = insertLongLinkWbr(output);

    return output;
}

// Performs most of the actual formatting work for formatText. Not intended to be called normally.
export function doFormatText(text, options) {
    let output = text;

    const tokens = new Map();

    // replace important words and phrases with tokens
    if (options.usernameMap) {
        output = autolinkAtMentions(output, tokens, options.usernameMap);
    }

    if (options.channelNamesMap) {
        output = autolinkChannelMentions(output, tokens, options.channelNamesMap, options.team);
    }

    output = autolinkEmails(output, tokens);
    output = autolinkHashtags(output, tokens);

    if (!('emoticons' in options) || options.emoticon) {
        output = Emoticons.handleEmoticons(output, tokens, options.emojis || EmojiStore.getEmojis());
    }

    if (options.searchPatterns) {
        output = highlightSearchTerms(output, tokens, options.searchPatterns);
    }

    if (!('mentionHighlight' in options) || options.mentionHighlight) {
        output = highlightCurrentMentions(output, tokens, options.mentionKeys);
    }

    if (!('emoticons' in options) || options.emoticon) {
        output = twemoji.parse(output, {
            className: 'emoticon',
            callback: (icon) => {
                if (!EmojiStore.hasUnicode(icon)) {
                    // just leave the unicode characters and hope the browser can handle it
                    return null;
                }

                return EmojiStore.getEmojiImageUrl(EmojiStore.getUnicode(icon));
            }
        });
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
    function replaceEmailWithToken(match) {
        const linkText = match.getMatchedText();
        let url = linkText;

        if (match.getType() === 'email') {
            url = `mailto:${url}`;
        }

        const index = tokens.size;
        const alias = `$MM_EMAIL${index}`;

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
        mention: false,
        hashtag: false,
        replaceFn: replaceEmailWithToken
    });

    return autolinker.link(text);
}

const punctuation = XRegExp.cache('[^\\pL\\d]');

export function autolinkAtMentions(text, tokens, usernameMap) {
    // Test if provided text needs to be highlighted, special mention or current user
    function mentionExists(u) {
        return (Constants.SPECIAL_MENTIONS.indexOf(u) !== -1 || Boolean(usernameMap[u]));
    }

    function addToken(username, mention) {
        const index = tokens.size;
        const alias = `$MM_ATMENTION${index}`;

        tokens.set(alias, {
            value: `<span data-mention='${username}'><a class='mention-link' href='#'>${mention}</a></span>`,
            originalText: mention
        });
        return alias;
    }

    function replaceAtMentionWithToken(fullMatch, prefix, mention, username) {
        const usernameLower = username.toLowerCase();

        // Check if the text makes up an explicit mention, possible trimming extra punctuation from the end of the name if necessary
        for (let c = usernameLower.length; c > 0; c--) {
            const truncated = usernameLower.substring(0, c);
            const suffix = usernameLower.substring(c);

            // If we've found a username or run out of punctuation to trim off, render it as an at mention
            if (mentionExists(truncated) || !punctuation.test(truncated[truncated.length - 1])) {
                const alias = addToken(truncated, '@' + truncated);
                return prefix + alias + suffix;
            }
        }

        return fullMatch;
    }

    let output = text;
    output = output.replace(/(^|\W)(@([a-z0-9.\-_]*))/gi, replaceAtMentionWithToken);

    return output;
}

function autolinkChannelMentions(text, tokens, channelNamesMap, team) {
    function channelMentionExists(c) {
        return Boolean(channelNamesMap[c]);
    }
    function addToken(channelName, mention, displayName) {
        const index = tokens.size;
        const alias = `$MM_CHANNELMENTION${index}`;
        let href = '#';
        if (team) {
            href = '/' + team.name + '/channels/' + channelName;
        }

        tokens.set(alias, {
            value: `<a class='mention-link' href="${href}" data-channel-mention="${channelName}">${displayName}</a>`,
            originalText: mention
        });
        return alias;
    }

    function replaceChannelMentionWithToken(fullMatch, spacer, mention, channelName) {
        let channelNameLower = channelName.toLowerCase();

        if (channelMentionExists(channelNameLower)) {
            // Exact match
            const alias = addToken(channelNameLower, mention, '~' + channelNamesMap[channelNameLower].display_name);
            return spacer + alias;
        }

        // Not an exact match, attempt to truncate any punctuation to see if we can find a channel
        const originalChannelName = channelNameLower;

        for (let c = channelNameLower.length; c > 0; c--) {
            if (punctuation.test(channelNameLower[c - 1])) {
                channelNameLower = channelNameLower.substring(0, c - 1);

                if (channelMentionExists(channelNameLower)) {
                    const suffix = originalChannelName.substr(c - 1);
                    const alias = addToken(channelNameLower, '~' + channelNameLower, '~' + channelNamesMap[channelNameLower].display_name);
                    return spacer + alias + suffix;
                }
            } else {
                // If the last character is not punctuation, no point in going any further
                break;
            }
        }

        return fullMatch;
    }

    let output = text;
    output = output.replace(/(^|\s)(~([a-z0-9.\-_]*))/gi, replaceChannelMentionWithToken);

    return output;
}

export function escapeRegex(text) {
    return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function highlightCurrentMentions(text, tokens, mentionKeys = []) {
    let output = text;

    // look for any existing tokens which are self mentions and should be highlighted
    var newTokens = new Map();
    for (const [alias, token] of tokens) {
        if (mentionKeys.indexOf(token.originalText) !== -1) {
            const index = tokens.size + newTokens.size;
            const newAlias = `$MM_SELFMENTION${index}`;

            newTokens.set(newAlias, {
                value: `<span class='mention--highlight'>${alias}</span>`,
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
        const alias = `$MM_SELFMENTION${index}`;

        tokens.set(alias, {
            value: `<span class='mention--highlight'>${mention}</span>`,
            originalText: mention
        });

        return prefix + alias;
    }

    for (const mention of mentionKeys) {
        if (!mention) {
            continue;
        }

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
            const newAlias = `$MM_HASHTAG${index}`;

            newTokens.set(newAlias, {
                value: `<a class='mention-link' href='#' data-hashtag='${token.originalText}'>${token.originalText}</a>`,
                originalText: token.originalText,
                hashtag: token.originalText.substring(1)
            });

            output = output.replace(alias, newAlias);
        }
    }

    // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
    for (const newToken of newTokens) {
        tokens.set(newToken[0], newToken[1]);
    }

    // look for hashtags in the text
    function replaceHashtagWithToken(fullMatch, prefix, originalText) {
        const index = tokens.size;
        const alias = `$MM_HASHTAG${index}`;

        if (text.length < Constants.MIN_HASHTAG_LINK_LENGTH + 1) {
            // too short to be a hashtag
            return fullMatch;
        }

        tokens.set(alias, {
            value: `<a class='mention-link' href='#' data-hashtag='${originalText}'>${originalText}</a>`,
            originalText,
            hashtag: originalText.substring(1)
        });

        return prefix + alias;
    }

    return output.replace(XRegExp.cache('(^|\\W)(#\\pL[\\pL\\d\\-_.]*[\\pL\\d])', 'g'), replaceHashtagWithToken);
}

const puncStart = XRegExp.cache('^[^\\pL\\d\\s#]+');
const puncEnd = XRegExp.cache('[^\\pL\\d\\s]+$');

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

        // capture at mentions differently from the server so we can highlight them with the preceeding at sign
        captured = (/^@\w+\b/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);

            terms.push(captured[0]);
            continue;
        }

        // capture any plain text up until the next quote or search flag
        captured = (/^.+?(?=\bin:|\bfrom:|\bchannel:|"|$)/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);

            // break the text up into words based on how the server splits them in SqlPostStore.SearchPosts and then discard empty terms
            terms.push(...captured[0].split(/[ <>+()~@]/).filter((term) => Boolean(term)));
            continue;
        }

        // we should never reach this point since at least one of the regexes should match something in the remaining text
        throw new Error('Infinite loop in search term parsing: "' + termString + '"');
    }

    // remove punctuation from each term
    terms = terms.map((term) => {
        term.replace(puncStart, '');
        if (term.charAt(term.length - 1) !== '*') {
            term.replace(puncEnd, '');
        }
        return term;
    });

    return terms;
}

function convertSearchTermToRegex(term) {
    let pattern;

    if (cjkPattern.test(term)) {
        // term contains Chinese, Japanese, or Korean characters so don't mark word boundaries
        pattern = '()(' + escapeRegex(term.replace(/\*/g, '')) + ')';
    } else if (term.endsWith('*')) {
        pattern = '\\b()(' + escapeRegex(term.substring(0, term.length - 1)) + ')';
    } else if (term.startsWith('@') || term.startsWith('#')) {
        // needs special handling of the first boundary because a word boundary doesn't work before a symbol
        pattern = '(\\W|^)(' + escapeRegex(term) + ')\\b';
    } else {
        pattern = '\\b()(' + escapeRegex(term) + ')\\b';
    }

    return new RegExp(pattern, 'gi');
}

export function highlightSearchTerms(text, tokens, searchPatterns) {
    if (!searchPatterns || searchPatterns.length === 0) {
        return text;
    }

    let output = text;

    function replaceSearchTermWithToken(match, prefix, word) {
        const index = tokens.size;
        const alias = `$MM_SEARCHTERM${index}`;

        tokens.set(alias, {
            value: `<span class='search-highlight'>${word}</span>`,
            originalText: word
        });

        return prefix + alias;
    }

    for (const pattern of searchPatterns) {
        // highlight existing tokens matching search terms
        var newTokens = new Map();
        for (const [alias, token] of tokens) {
            if (pattern.test(token.originalText)) {
                const index = tokens.size + newTokens.size;
                const newAlias = `$MM_SEARCHTERM${index}`;

                newTokens.set(newAlias, {
                    value: `<span class='search-highlight'>${alias}</span>`,
                    originalText: token.originalText
                });

                output = output.replace(alias, newAlias);
            }

            // The pattern regexes are global, so calling pattern.test() above alters their
            // state. Reset lastIndex to 0 between calls to test() to ensure it returns the
            // same result every time it is called with the same value of token.originalText.
            pattern.lastIndex = 0;
        }

        // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
        for (const newToken of newTokens) {
            tokens.set(newToken[0], newToken[1]);
        }

        output = output.replace(pattern, replaceSearchTermWithToken);
    }

    return output;
}

export function replaceTokens(text, tokens) {
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

//replace all "/" inside <a> tags to "/<wbr />"
function insertLongLinkWbr(test) {
    return test.replace(/\//g, (match, position, string) => {
        return match + ((/a[^>]*>[^<]*$/).test(string.substr(0, position)) ? '<wbr />' : '');
    });
}

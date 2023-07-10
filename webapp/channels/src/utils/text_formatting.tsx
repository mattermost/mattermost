// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import emojiRegex from 'emoji-regex';
import {Renderer} from 'marked';

import {SystemEmoji} from '@mattermost/types/emojis';

import {formatWithRenderer} from 'utils/markdown';

import * as Emoticons from './emoticons';
import * as Markdown from './markdown';
import Constants from './constants';
import EmojiMap from './emoji_map.js';

const punctuationRegex = /[^\p{L}\d]/u;
const AT_MENTION_PATTERN = /(?:\B|\b_+)@([a-z0-9.\-_]+)/gi;
const UNICODE_EMOJI_REGEX = emojiRegex();
const htmlEmojiPattern = /^<p>\s*(?:<img class="emoticon"[^>]*>|<span data-emoticon[^>]*>[^<]*<\/span>\s*|<span class="emoticon emoticon--unicode">[^<]*<\/span>\s*)+<\/p>$/;

// Performs formatting of user posts including highlighting mentions and search terms and converting urls, hashtags,
// @mentions and ~channels to links by taking a user's message and returning a string of formatted html. Also takes
// a number of options as part of the second parameter:
export type ChannelNamesMap = {
    [name: string]: {
        display_name: string;
        team_name?: string;
    } | string;
};

export type Tokens = Map<
string,
{ value: string; originalText: string; hashtag?: string }
>;

export type SearchPattern = {
    pattern: RegExp;
    term: string;
};

export type MentionKey = {
    key: string;
    caseSensitive?: boolean;
};

export type Team = {
    id: string;
    name: string;
    display_name: string;
};

interface TextFormattingOptionsBase {

    /**
     * If specified, this word is highlighted in the resulting html.
     *
     * Defaults to nothing.
     */
    searchTerm: string;

    /**
     * If specified, an array of words that will be highlighted.
     *
     * If both this and `searchTerm` are specified, this takes precedence.
     *
     * Defaults to nothing.
     */
    searchMatches: string[];

    searchPatterns: SearchPattern[];

    /**
     * Specifies whether or not to highlight mentions of the current user.
     *
     * Defaults to `true`.
     */
    mentionHighlight: boolean;

    /**
     * Specifies whether or not to display group mentions as blue links.
     *
     * Defaults to `false`.
     */
    disableGroupHighlight: boolean;

    /**
     * A list of mention keys for the current user to highlight.
     */
    mentionKeys: MentionKey[];

    /**
     * Specifies whether or not to remove newlines.
     *
     * Defaults to `false`.
     */
    singleline: boolean;

    /**
     * Enables emoticon parsing with a data-emoticon attribute.
     *
     * Defaults to `true`.
     */
    emoticons: boolean;

    /**
     * Enables markdown parsing.
     *
     * Defaults to `true`.
     */
    markdown: boolean;

    /**
     * The origin of this Mattermost instance.
     *
     * If provided, links to channels and posts will be replaced with internal
     * links that can be handled by a special click handler.
     */
    siteURL: string;

    /**
     * Whether or not to render at mentions into spans with a data-mention attribute.
     *
     * Defaults to `false`.
     */
    atMentions: boolean;

    /**
     * An object mapping channel display names to channels.
     *
     * If provided, ~channel mentions will be replaced with links to the relevant channel.
     */
    channelNamesMap: ChannelNamesMap;

    /**
     * The current team.
     */
    team: Team;

    /**
     * If specified, images are proxied.
     *
     * Defaults to `false`.
     */
    proxyImages: boolean;

    /**
     * An array of url schemes that will be allowed for autolinking.
     *
     * Defaults to autolinking with any url scheme.
     */
    autolinkedUrlSchemes: string[];

    /**
     * An array of paths on the server that are managed by another server. Any path provided will be treated as an
     * external link that will not by handled by react-router.
     *
     * Defaults to an empty array.
     */
    managedResourcePaths: string[];

    /**
     * A custom renderer object to use in the formatWithRenderer function.
     *
     * Defaults to empty.
     */
    renderer: Renderer;

    /**
     * Minimum number of characters in a hashtag.
     *
     * Defaults to `3`.
     */
    minimumHashtagLength: number;

    /**
     * the timestamp on which the post was last edited
     */
    editedAt: number;
    postId: string;

    /**
     * Whether or not to render sum of members mentions e.g. "5 members..." into spans with a data-sum-of-members-mention attribute.
     *
     * Defaults to `false`.
     */
    atSumOfMembersMentions: boolean;

    /**
     * Whether or not to render plan mentions e.g. "Professional plan, Enterprise plan, Starter plan" into spans with a data-plan-mention attribute.
     *
     * Defaults to `false`.
     */
    atPlanMentions: boolean;
}

export type TextFormattingOptions = Partial<TextFormattingOptionsBase>;

const DEFAULT_OPTIONS: TextFormattingOptions = {
    mentionHighlight: true,
    disableGroupHighlight: false,
    singleline: false,
    emoticons: true,
    markdown: true,
    atMentions: false,
    atSumOfMembersMentions: false,
    atPlanMentions: false,
    minimumHashtagLength: 3,
    proxyImages: false,
    editedAt: 0,
    postId: '',
};

/**
* pattern to detect the existence of a Chinese, Japanese, or Korean character in a string
* http://stackoverflow.com/questions/15033196/using-javascript-to-check-whether-a-string-contains-japanese-characters-includi
* recently enhanced to support some more CJK, Hangul, and Cyrillic characters
* CJK punctuation: \u3000-\u303f
* Hiragana: \u3040-\u309f
* Katakana: \u30a0-\u30ff
* Full-width ASCII characters: \uff00-\uff9f
* Common CJK characters: \u4e00-\u9fff
* Additional CJK characters: \u3400-\u4dbf
* Hangul characters: \uac00-\ud7af
* Hangul Jamo: \u1100-\u11ff
* Hangul Compatibility Jamo: \u3130-\u318f
* Cyrillic characters: \u0400-\u04ff, \u0500-\u052f
* Additional CJK and Hangul compatibility characters: \u2de0-\u2dff
**/
// eslint-disable-next-line no-misleading-character-class
const cjkrPattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\u0400-\u04ff\u0500-\u052f\u2de0-\u2dff]/;

export function formatText(
    text: string,
    inputOptions: TextFormattingOptions = DEFAULT_OPTIONS,
    emojiMap: EmojiMap,
): string {
    if (!text) {
        return '';
    }

    let output = text;
    const options = Object.assign({}, inputOptions);
    const hasPhrases = (/"([^"]*)"/).test(options.searchTerm || '');

    if (options.searchMatches && !hasPhrases) {
        options.searchPatterns = options.searchMatches.map(convertSearchTermToRegex);
    } else {
        options.searchPatterns = parseSearchTerms(options.searchTerm || '').map(convertSearchTermToRegex).sort((a, b) => {
            return b.term.length - a.term.length;
        });
    }

    if (options.renderer) {
        output = formatWithRenderer(output, options.renderer);
        output = doFormatText(output, options, emojiMap);
    } else if (!('markdown' in options) || options.markdown) {
        // the markdown renderer will call doFormatText as necessary
        output = Markdown.format(output, options, emojiMap);
        if (output.includes('class="markdown-inline-img"')) {
            const replacer = (match: string) => {
                /*
                 * remove p tag to allow other divs to be nested,
                 * which allows markdown images to open preview window
                 */
                return match === '<p>' ? '<div class="markdown-inline-img__container">' : '</div>';
            };

            /*
             * Fix for MM-22267 - replace any carriage-return (\r), line-feed (\n) or cr-lf (\r\n) occurences
             * in enclosing `<p>` tags with `<br/>` breaks to show correct line-breaks in the UI
             *
             * the Markdown.format function removes all duplicate line-breaks beforehand, so it is safe to just
             * replace occurrences which are not followed by opening <p> tags to prevent duplicate line-breaks
             *
             * The data-codeblock-code part is a fix for MM-45349 - do not replace newlines with `<br/>`
             * in code blocks, as they become visible in the message
             */
            output = output.replace(/data-codeblock-code="[^"]+"|[\r\n]+(?!(<p>))/g, (match: string) => {
                if (match.includes('data-codeblock-code')) {
                    return match;
                }

                return '<br/>';
            });

            /*
             * the replacer is not ideal, since it replaces every occurence with a new div
             * It would be better to more accurately match only the element in question
             * and replace it with an inlione-version
             */
            output = output.replace(/<p>|<\/p>/g, replacer);
        }
    } else {
        output = sanitizeHtml(output);
        output = doFormatText(output, options, emojiMap);
    }

    // replace newlines with spaces if necessary
    if (options.singleline) {
        output = replaceNewlines(output);
    }

    if (htmlEmojiPattern.test(output.trim())) {
        output = `<span class="all-emoji">${output.trim()}</span>`;
    }

    if (options.postId) {
        // unwrap the output from the closing p tag and add a span that will serve as a
        // palceholder for `messageToHtmlComponent` function later on
        if (output.endsWith('</p>')) {
            output = `${output.slice(0, -4)}<span data-edited-post-id='${options.postId}'></span></p>`;
        } else {
            output += `<span data-edited-post-id='${options.postId}'></span>`;
        }
    }

    return output;
}

// Performs most of the actual formatting work for formatText. Not intended to be called normally.
export function doFormatText(text: string, options: TextFormattingOptions, emojiMap: EmojiMap): string {
    let output = text;

    const tokens = new Map();

    // replace important words and phrases with tokens
    if (options.atMentions) {
        output = autolinkAtMentions(output, tokens);
    }

    if (options.atSumOfMembersMentions) {
        output = autoLinkSumOfMembersMentions(output, tokens);
    }

    if (options.atPlanMentions) {
        output = autoPlanMentions(output, tokens);
    }

    if (options.channelNamesMap) {
        output = autolinkChannelMentions(
            output,
            tokens,
            options.channelNamesMap,
            options.team,
        );
    }

    output = autolinkEmails(output, tokens);
    output = autolinkHashtags(output, tokens, options.minimumHashtagLength);

    if (!('emoticons' in options) || options.emoticons) {
        output = Emoticons.handleEmoticons(output, tokens);
    }

    if (options.searchPatterns) {
        output = highlightSearchTerms(output, tokens, options.searchPatterns);
    }

    if (!('mentionHighlight' in options) || options.mentionHighlight) {
        output = highlightCurrentMentions(output, tokens, options.mentionKeys);
    }

    if (!('emoticons' in options) || options.emoticons) {
        output = handleUnicodeEmoji(output, emojiMap, UNICODE_EMOJI_REGEX);
    }

    // reinsert tokens with formatted versions of the important words and phrases
    output = replaceTokens(output, tokens);

    return output;
}

export function sanitizeHtml(text: string): string {
    let output = text;

    // normal string.replace only does a single occurrence so use a regex instead
    output = output.replace(/&/g, '&amp;');
    output = output.replace(/</g, '&lt;');
    output = output.replace(/>/g, '&gt;');
    output = output.replace(/'/g, '&apos;');
    output = output.replace(/"/g, '&quot;');

    return output;
}

// Copied from our fork of commonmark.js
// eslint-disable-next-line no-useless-escape
const emailRegex = /(^|[^\p{L}\d])((?:[\p{L}\p{Nd}!#$%&'*+\-\/=?^_`{|}~](?:[\p{L}\p{Nd}!#$%&'*+\-\/=?^_`{|}~]|\.(?!\.|@))*|"[\p{L}\p{Nd}!#$%&'*+\-\/=?^_`{|}~\s(),:;<>@\[\].]+")@[\p{L}\d.\-]+[.]\p{L}{2,5}(?=$|[^\p{L}]))/gu;

// Convert emails into tokens
function autolinkEmails(text: string, tokens: Tokens) {
    function replaceEmailWithToken(
        fullMatch: string,
        ...args: Array<string | number>
    ) {
        const prefix = args[0] as string;
        const email = args[1] as string;

        const index = tokens.size;
        const alias = `$MM_EMAIL${index}$`;

        tokens.set(alias, {
            value: `<a class="theme" href="mailto:${email}" rel="noreferrer" target="_blank">${email}</a>`,
            originalText: email,
        });

        return prefix + alias;
    }

    return text.replace(emailRegex, replaceEmailWithToken);
}

export function autoLinkSumOfMembersMentions(text: string, tokens: Tokens): string {
    function replaceSumOfMembersMentionWithToken(fullMatch: string) {
        const index = tokens.size;
        const alias = `$MM_SUMOFMEMBERSMENTION${index}$`;

        tokens.set(alias, {
            value: `<span data-sum-of-members-mention="${fullMatch}">${fullMatch}</span>`,
            originalText: fullMatch,
        });

        return alias;
    }

    let output = text;
    output = output.replace(
        Constants.SUM_OF_MEMBERS_MENTION_REGEX,
        replaceSumOfMembersMentionWithToken,
    );

    return output;
}

export function autoPlanMentions(text: string, tokens: Tokens): string {
    function replacePlanMentionWithToken(fullMatch: string) {
        const index = tokens.size;
        const alias = `$MM_PLANMENTION${index}$`;

        tokens.set(alias, {
            value: `<span data-plan-mention="${fullMatch}">${fullMatch}</span>`,
            originalText: fullMatch,
        });

        return alias;
    }

    let output = text;
    output = output.replace(
        Constants.PLAN_MENTIONS,
        replacePlanMentionWithToken,
    );

    return output;
}

export function autolinkAtMentions(text: string, tokens: Tokens): string {
    function replaceAtMentionWithToken(fullMatch: string, username: string) {
        let originalText = fullMatch;

        // Deliberately remove all leading underscores since regex matches leading underscore by treating it as non word boundary
        while (originalText[0] === '_') {
            originalText = originalText.substring(1);
        }

        const index = tokens.size;
        const alias = `$MM_ATMENTION${index}$`;

        tokens.set(alias, {
            value: `<span data-mention="${username}">@${username}</span>`,
            originalText,
        });

        return alias;
    }

    let output = text;

    // handle @channel, @all, @here mentions first (supports trailing punctuation)
    output = output.replace(
        Constants.SPECIAL_MENTIONS_REGEX,
        replaceAtMentionWithToken,
    );

    // handle all other mentions (supports trailing punctuation)
    let match = output.match(AT_MENTION_PATTERN);
    while (match && match.length > 0) {
        output = output.replace(AT_MENTION_PATTERN, replaceAtMentionWithToken);
        match = output.match(AT_MENTION_PATTERN);
    }

    return output;
}

export function allAtMentions(text: string): RegExpMatchArray {
    return text.match(Constants.SPECIAL_MENTIONS_REGEX && AT_MENTION_PATTERN) || [];
}

export function autolinkChannelMentions(
    text: string,
    tokens: Tokens,
    channelNamesMap: ChannelNamesMap,
    team?: Team,
) {
    function channelMentionExists(c: string) {
        return channelNamesMap.hasOwnProperty(c);
    }
    function addToken(channelName: string, teamName: string, mention: string, displayName: string) {
        const index = tokens.size;
        const alias = `$MM_CHANNELMENTION${index}$`;
        let href = '#';
        if (teamName) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href = ((window as any).basename || '') + '/' + teamName + '/channels/' + channelName;
            tokens.set(alias, {
                value: `<a class="mention-link" href="${href}" data-channel-mention-team="${teamName}" data-channel-mention="${channelName}">~${displayName}</a>`,
                originalText: mention,
            });
        } else if (team) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href = ((window as any).basename || '') + '/' + team.name + '/channels/' + channelName;
            tokens.set(alias, {
                value: `<a class="mention-link" href="${href}" data-channel-mention="${channelName}">~${displayName}</a>`,
                originalText: mention,
            });
        }

        return alias;
    }

    function replaceChannelMentionWithToken(
        fullMatch: string,
        mention: string,
        channelName: string,
    ) {
        let channelNameLower = channelName.toLowerCase();

        if (channelMentionExists(channelNameLower)) {
            // Exact match
            let displayName = '';
            let teamName = '';

            const channelValue = channelNamesMap[channelNameLower];
            if (typeof channelValue === 'object') {
                displayName = channelValue.display_name;
                teamName = channelValue.team_name || '';
            } else {
                displayName = channelValue;
            }

            return addToken(
                channelNameLower,
                teamName,
                mention,
                escapeHtml(displayName),
            );
        }

        // Not an exact match, attempt to truncate any punctuation to see if we can find a channel
        const originalChannelName = channelNameLower;

        for (let c = channelNameLower.length; c > 0; c--) {
            if (punctuationRegex.test(channelNameLower[c - 1])) {
                channelNameLower = channelNameLower.substring(0, c - 1);

                if (channelMentionExists(channelNameLower)) {
                    const suffix = originalChannelName.substr(c - 1);

                    let displayName = '';
                    let teamName = '';

                    const channelValue = channelNamesMap[channelNameLower];
                    if (typeof channelValue === 'object') {
                        displayName = channelValue.display_name;
                        teamName = channelValue.team_name || '';
                    } else {
                        displayName = channelValue;
                    }

                    const alias = addToken(
                        channelNameLower,
                        teamName,
                        '~' + channelNameLower,
                        escapeHtml(displayName),
                    );
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
    output = output.replace(
        /\B(~([a-z0-9.\-_]*))/gi,
        replaceChannelMentionWithToken,
    );

    return output;
}

export function escapeRegex(text?: string): string {
    return text?.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') || '';
}

const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
};

export function escapeHtml(text: string): string {
    return text.replace(
        /[&<>"']/g,
        (match: string) => htmlEntities[match as keyof (typeof htmlEntities)],
    );
}

export function convertEntityToCharacter(text: string): string {
    return text.
        replace(/&lt;/g, '<').
        replace(/&gt;/g, '>').
        replace(/&#39;/g, "'").
        replace(/&quot;/g, '"').
        replace(/&amp;/g, '&');
}

export function highlightCurrentMentions(
    text: string,
    tokens: Tokens,
    mentionKeys: MentionKey[] = [],
) {
    let output = text;

    // look for any existing tokens which are self mentions and should be highlighted
    const newTokens = new Map();
    for (const [alias, token] of tokens) {
        const tokenTextLower = token.originalText.toLowerCase();

        if (mentionKeys.findIndex((key) => key.key.toLowerCase() === tokenTextLower) !== -1) {
            const index = tokens.size + newTokens.size;
            const newAlias = `$MM_SELFMENTION${index}$`;

            newTokens.set(newAlias, {
                value: `<span class="mention--highlight">${alias}</span>`,
                originalText: token.originalText,
            });
            output = output.replace(alias, newAlias);
        }
    }

    // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
    for (const newToken of newTokens) {
        tokens.set(newToken[0], newToken[1]);
    }

    // look for self mentions in the text
    function replaceCurrentMentionWithToken(
        fullMatch: string,
        prefix: string,
        mention: string,
        suffix = '',
    ) {
        const index = tokens.size;
        const alias = `$MM_SELFMENTION${index}$`;

        tokens.set(alias, {
            value: `<span class="mention--highlight">${mention}</span>`,
            originalText: mention,
        });

        return prefix + alias + suffix;
    }

    for (const mention of mentionKeys) {
        if (!mention || !mention.key) {
            continue;
        }

        let flags = 'g';
        if (!mention.caseSensitive) {
            flags += 'i';
        }

        let pattern;
        if (cjkrPattern.test(mention.key)) {
            // In the case of CJK mention key, even if there's no delimiters (such as spaces) at both ends of a word, it is recognized as a mention key
            pattern = new RegExp(`()(${escapeRegex(mention.key)})()`, flags);
        } else {
            pattern = new RegExp(
                `(^|\\W)(${escapeRegex(mention.key)})(\\b|_+\\b)`,
                flags,
            );
        }
        output = output.replace(pattern, replaceCurrentMentionWithToken);
    }

    return output;
}

const hashtagRegex = /(^|\W)(#\p{L}[\p{L}\d\-_.]*[\p{L}\d])/gu;

function autolinkHashtags(
    text: string,
    tokens: Tokens,
    minimumHashtagLength = 3,
) {
    let output = text;

    const newTokens = new Map();
    for (const [alias, token] of tokens) {
        if (token.originalText.lastIndexOf('#', 0) === 0) {
            const index = tokens.size + newTokens.size;
            const newAlias = `$MM_HASHTAG${index}$`;

            newTokens.set(newAlias, {
                value: `<a class='mention-link' href='#' data-hashtag='${token.originalText}'>${token.originalText}</a>`,
                originalText: token.originalText,
                hashtag: token.originalText.substring(1),
            });

            output = output.replace(alias, newAlias);
        }
    }

    // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
    for (const newToken of newTokens) {
        tokens.set(newToken[0], newToken[1]);
    }

    // look for hashtags in the text
    function replaceHashtagWithToken(
        fullMatch: string,
        prefix: string,
        originalText: string,
    ) {
        const index = tokens.size;
        const alias = `$MM_HASHTAG${index}$`;

        if (originalText.length < minimumHashtagLength + 1) {
            // too short to be a hashtag
            return fullMatch;
        }

        tokens.set(alias, {
            value: `<a class='mention-link' href='#' data-hashtag='${originalText}'>${originalText}</a>`,
            originalText,
            hashtag: originalText.substring(1),
        });

        return prefix + alias;
    }

    return output.replace(
        hashtagRegex,
        replaceHashtagWithToken,
    );
}

const puncStart = /^[^\p{L}\d\s#]+/u;
const puncEnd = /[^\p{L}\d\s]+$/u;

export function parseSearchTerms(searchTerm: string): string[] {
    let terms = [];

    let termString = searchTerm;

    while (termString) {
        let captured;

        // check for a quoted string
        captured = (/^"([^"]*)"/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);

            if (captured[1].length > 0) {
                terms.push(captured[1]);
            }
            continue;
        }

        // check for a search flag (and don't add it to terms)
        captured = (/^-?(?:in|from|channel|on|before|after): ?\S+/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);
            continue;
        }

        // capture at mentions differently from the server so we can highlight them with the preceeding at sign
        captured = (/^@[a-z0-9.-_]+\b/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);

            terms.push(captured[0]);
            continue;
        }

        // capture any plain text up until the next quote or search flag
        captured = (/^.+?(?=(?:\b|\B-)(?:in:|from:|channel:|on:|before:|after:)|"|$)/).exec(termString);
        if (captured) {
            termString = termString.substring(captured[0].length);

            // break the text up into words based on how the server splits them in SqlPostStore.SearchPosts and then discard empty terms
            terms.push(
                ...captured[0].split(/[ <>+()~@]/).filter((term) => Boolean(term)),
            );
            continue;
        }

        // we should never reach this point since at least one of the regexes should match something in the remaining text
        throw new Error(
            'Infinite loop in search term parsing: "' + termString + '"',
        );
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

function convertSearchTermToRegex(term: string): SearchPattern {
    let pattern;

    if (cjkrPattern.test(term)) {
        // term contains Chinese, Japanese, or Korean characters so don't mark word boundaries
        pattern = '()(' + escapeRegex(term.replace(/\*/g, '')) + ')';
    } else if ((/[^\s][*]$/).test(term)) {
        pattern = '\\b()(' + escapeRegex(term.substring(0, term.length - 1)) + ')';
    } else if (term.startsWith('@') || term.startsWith('#')) {
        // needs special handling of the first boundary because a word boundary doesn't work before a symbol
        pattern = '(\\W|^)(' + escapeRegex(term) + ')\\b';
    } else {
        pattern = '\\b()(' + escapeRegex(term) + ')\\b';
    }

    return {
        pattern: new RegExp(pattern, 'gi'),
        term,
    };
}

export function highlightSearchTerms(
    text: string,
    tokens: Tokens,
    searchPatterns: SearchPattern[],
): string {
    if (!searchPatterns || searchPatterns.length === 0) {
        return text;
    }

    let output = text;

    function replaceSearchTermWithToken(
        match: string,
        prefix: string,
        word: string,
    ) {
        const index = tokens.size;
        const alias = `$MM_SEARCHTERM${index}$`;

        tokens.set(alias, {
            value: `<span class="search-highlight">${word}</span>`,
            originalText: word,
        });

        return prefix + alias;
    }

    for (const pattern of searchPatterns) {
        // highlight existing tokens matching search terms
        const newTokens = new Map();
        for (const [alias, token] of tokens) {
            if (pattern.pattern.test(token.originalText)) {
                // If it's a Hashtag, skip it unless the search term is an exact match.
                let originalText = token.originalText;
                if (originalText.startsWith('#')) {
                    originalText = originalText.substr(1);
                }
                let term = pattern.term;
                if (term.startsWith('#')) {
                    term = term.substr(1);
                }

                if (
                    alias.startsWith('$MM_HASHTAG') &&
          alias.endsWith('$') &&
          originalText.toLowerCase() !== term.toLowerCase()
                ) {
                    continue;
                }

                const index = tokens.size + newTokens.size;
                const newAlias = `$MM_SEARCHTERM${index}$`;

                newTokens.set(newAlias, {
                    value: `<span class="search-highlight">${alias}</span>`,
                    originalText: token.originalText,
                });

                output = output.replace(alias, newAlias);
            }

            // The pattern regexes are global, so calling pattern.pattern.test() above alters their
            // state. Reset lastIndex to 0 between calls to test() to ensure it returns the
            // same result every time it is called with the same value of token.originalText.
            pattern.pattern.lastIndex = 0;
        }

        // the new tokens are stashed in a separate map since we can't add objects to a map during iteration
        for (const newToken of newTokens) {
            tokens.set(newToken[0], newToken[1]);
        }

        output = output.replace(pattern.pattern, replaceSearchTermWithToken);
    }

    return output;
}

export function replaceTokens(text: string, tokens: Tokens): string {
    let output = text;

    // iterate backwards through the map so that we do replacement in the opposite order that we added tokens
    const aliases = [...tokens.keys()];
    for (let i = aliases.length - 1; i >= 0; i--) {
        const alias = aliases[i];
        const token = tokens.get(alias);
        output = output.replace(alias, token ? token.value : '');
    }

    return output;
}

function replaceNewlines(text: string) {
    return text.replace(/\n/g, ' ');
}

export function handleUnicodeEmoji(text: string, emojiMap: EmojiMap, searchPattern: RegExp): string {
    let output = text;

    // replace all occurances of unicode emoji with additional markup
    output = output.replace(searchPattern, (emojiMatch) => {
        // convert unicode character to hex string
        const codePoints = [fixedCharCodeAt(emojiMatch, 0)];

        if (emojiMatch.length > 1) {
            for (let i = 1; i < emojiMatch.length; i++) {
                const codePoint = fixedCharCodeAt(emojiMatch, i);
                if (codePoint === -1) {
                    // Not a complete character
                    continue;
                }

                codePoints.push(codePoint);
            }
        }

        const emojiCode = codePoints.map((codePoint) => codePoint.toString(16)).join('-');

        // convert emoji to image if supported, or wrap in span to apply appropriate formatting
        if (emojiMap && emojiMap.hasUnicode(emojiCode)) {
            // we typecasted here because we know that the emojiMap has the emoji with given emojiCode
            const emoji = emojiMap.getUnicode(emojiCode) as SystemEmoji;

            return Emoticons.renderEmoji(emoji.short_names[0], emojiMatch);
        }

        // wrap unsupported unicode emoji in span to style as needed
        return `<span class="emoticon emoticon--unicode">${emojiMatch}</span>`;
    });

    return output;
}

// Gets the unicode character code of a character starting at the given index in the string
// Adapted from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charCodeAt
function fixedCharCodeAt(str: string, idx = 0) {
    // ex. fixedCharCodeAt('\uD800\uDC00', 0); // 65536
    // ex. fixedCharCodeAt('\uD800\uDC00', 1); // false
    const code = str.charCodeAt(idx);

    // High surrogate (could change last hex to 0xDB7F to treat high
    // private surrogates as single characters)
    if (code >= 0xD800 && code <= 0xDBFF) {
        const hi = code;
        const low = str.charCodeAt(idx + 1);

        if (isNaN(low)) {
            console.log('High surrogate not followed by low surrogate in fixedCharCodeAt()'); // eslint-disable-line
        }

        return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
    }

    if (code >= 0xDC00 && code <= 0xDFFF) { // Low surrogate
        // We return false to allow loops to skip this iteration since should have
        // already handled high surrogate above in the previous iteration
        return -1;
    }

    return code;
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatWithRenderer} from './markdown';
import MentionableRenderer from './markdown/mentionable_renderer';

export const emoticonPatterns: { [key: string]: RegExp } = {
    slightly_smiling_face: /(^|\B)(:-?\))($|\B)/g, // :)
    wink: /(^|\B)(;-?\))($|\B)/g, // ;)
    open_mouth: /(^|\B)(:o)($|\b)/gi, // :o
    scream: /(^|\B)(:-o)($|\b)/gi, // :-o
    smirk: /(^|\B)(:-?])($|\B)/g, // :]
    smile: /(^|\B)(:-?d)($|\b)/gi, // :D
    stuck_out_tongue_closed_eyes: /(^|\b)(x-d)($|\b)/gi, // x-d
    stuck_out_tongue: /(^|\B)(:-?p)($|\b)/gi, // :p
    rage: /(^|\B)(:-?[[@])($|\B)/g, // :@
    slightly_frowning_face: /(^|\B)(:-?\()($|\B)/g, // :(
    cry: /(^|\B)(:[`'’]-?\(|:&#x27;\(|:&#39;\()($|\B)/g, // :`(
    confused: /(^|\B)(:-?\/)($|\B)/g, // :/
    confounded: /(^|\B)(:-?s)($|\b)/gi, // :s
    neutral_face: /(^|\B)(:-?\|)($|\B)/g, // :|
    flushed: /(^|\B)(:-?\$)($|\B)/g, // :$
    mask: /(^|\B)(:-x)($|\b)/gi, // :-x
    heart: /(^|\B)(<3|&lt;3)($|\b)/g, // <3
    broken_heart: /(^|\B)(<\/3|&lt;\/3)($|\b)/g, // </3
};

export const EMOJI_PATTERN = /(:([a-zA-Z0-9_+-]+):)/g;

export function matchEmoticons(text: string): RegExpMatchArray | null {
    const markdownCleanedText = formatWithRenderer(text, new MentionableRenderer());
    let emojis = markdownCleanedText.match(EMOJI_PATTERN);

    for (const name of Object.keys(emoticonPatterns)) {
        const pattern = emoticonPatterns[name];

        const matches = markdownCleanedText.match(pattern);
        if (matches) {
            if (emojis) {
                emojis = emojis.concat(matches);
            } else {
                emojis = matches;
            }
        }
    }

    return emojis;
}

export function handleEmoticons(
    text: string,
    tokens: Map<string, {value: string; originalText: string}>,
): string {
    let output = text;

    function replaceEmoticonWithToken(
        fullMatch: string,
        prefix: string,
        matchText: string,
        name: string,
    ): string {
        const index = tokens.size;
        const alias = `$MM_EMOTICON${index}$`;

        tokens.set(alias, {
            value: renderEmoji(name, matchText),
            originalText: fullMatch,
        });

        return prefix + alias;
    }

    // match named emoticons like :goat:
    output = output.replace(
        EMOJI_PATTERN,
        (fullMatch: string, matchText: string, name: string): string =>
            replaceEmoticonWithToken(fullMatch, '', matchText, name),
    );

    // match text smilies like :D
    for (const name of Object.keys(emoticonPatterns)) {
        const pattern = emoticonPatterns[name];

        // this might look a bit funny, but since the name isn't contained in the actual match
        // like with the named emoticons, we need to add it in manually
        output = output.replace(pattern, (fullMatch, prefix, matchText) => replaceEmoticonWithToken(fullMatch, prefix, matchText, name));
    }

    return output;
}

export function renderEmoji(name: string, matchText: string): string {
    return `<span data-emoticon="${name.toLowerCase()}">${matchText.toLowerCase()}</span>`;
}

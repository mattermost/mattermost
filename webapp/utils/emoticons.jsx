// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import Constants from './constants.jsx';
import emojis from './emoji.json';

const emoticonPatterns = {
    smile: /(^|\s)(:-?\))(?=$|\s)/g, // :)
    wink: /(^|\s)(;-?\))(?=$|\s)/g, // ;)
    open_mouth: /(^|\s)(:o)(?=$|\s)/gi, // :o
    scream: /(^|\s)(:-o)(?=$|\s)/gi, // :-o
    smirk: /(^|\s)(:-?])(?=$|\s)/g, // :]
    grinning: /(^|\s)(:-?d)(?=$|\s)/gi, // :D
    stuck_out_tongue_closed_eyes: /(^|\s)(x-d)(?=$|\s)/gi, // x-d
    stuck_out_tongue: /(^|\s)(:-?p)(?=$|\s)/gi, // :p
    rage: /(^|\s)(:-?[\[@])(?=$|\s)/g, // :@
    frowning: /(^|\s)(:-?\()(?=$|\s)/g, // :(
    cry: /(^|\s)(:['’]-?\(|:&#x27;\(|:&#39;\()(?=$|\s)/g, // :`(
    confused: /(^|\s)(:-?\/)(?=$|\s)/g, // :/
    confounded: /(^|\s)(:-?s)(?=$|\s)/gi, // :s
    neutral_face: /(^|\s)(:-?\|)(?=$|\s)/g, // :|
    flushed: /(^|\s)(:-?\$)(?=$|\s)/g, // :$
    mask: /(^|\s)(:-x)(?=$|\s)/gi, // :-x
    heart: /(^|\s)(<3|&lt;3)(?=$|\s)/g, // <3
    broken_heart: /(^|\s)(<\/3|&lt;&#x2F;3)(?=$|\s)/g, // </3
    thumbsup: /(^|\s)(:\+1:)(?=$|\s)/g, // :+1:
    thumbsdown: /(^|\s)(:\-1:)(?=$|\s)/g // :-1:
};

export const emoticons = initializeEmoticons();

function initializeEmoticons() {
    const emoticons = new Map();

    for (const emoji of emojis) {
        const unicode = emoji.emoji;

        let filename = '';
        if (emoji.emoji) {
            // this is a unicode emoji so the character code determines the file name
            const code = fixedCharCodeAt(emoji.emoji, 0).toString(16);
            filename = pad(code.toString(16));

            if (emoji.emoji.length > 2) {
                // some emojis like the country flags span multiple utf-16 characters
                for (let i = 2; i < emoji.emoji.length; i += 2) {
                    const code = fixedCharCodeAt(emoji.emoji, i);

                    // ignore variation selectors
                    if (code < 0xfe00 || code > 0xfe0f) {
                        filename += '-' + pad(code.toString(16));
                    }
                }
            }
        } else {
            // this isn't a unicode emoji so the first alias determines the file name
            filename = emoji.aliases[0];
        }

        for (const alias of emoji.aliases) {
            emoticons.set(alias, {
                alias,
                path: getImagePathForEmoticon(filename)
            });
        }
    }

    return emoticons;
}

// Pads a hexadecimal number with zeroes to be at least 4 digits long
function pad(n) {
    if (n.length >= 4) {
        return n;
    }

    // http://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript
    return ('0000' + n).slice(-4);
}

// Gets the unicode character code of a character starting at the given index in the string
// Adapted from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charCodeAt
function fixedCharCodeAt(str, idx = 0) {
    // ex. fixedCharCodeAt('\uD800\uDC00', 0); // 65536
    // ex. fixedCharCodeAt('\uD800\uDC00', 1); // false
    const code = str.charCodeAt(idx);

    // High surrogate (could change last hex to 0xDB7F to treat high
    // private surrogates as single characters)
    if (0xD800 <= code && code <= 0xDBFF) {
        const hi = code;
        const low = str.charCodeAt(idx + 1);

        if (isNaN(low)) {
            console.log('High surrogate not followed by low surrogate in fixedCharCodeAt()'); // eslint-ignore-line
        }

        return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
    }

    if (0xDC00 <= code && code <= 0xDFFF) { // Low surrogate
        // We return false to allow loops to skip this iteration since should have
        // already handled high surrogate above in the previous iteration
        return false;
    }

    return code;
}

export function handleEmoticons(text, tokens) {
    let output = text;

    function replaceEmoticonWithToken(fullMatch, prefix, matchText, name) {
        if (emoticons.has(name)) {
            const index = tokens.size;
            const alias = `MM_EMOTICON${index}`;
            const path = emoticons.get(name).path;

            tokens.set(alias, {
                value: `<img align="absmiddle" alt="${matchText}" class="emoticon" src="${path}" title="${matchText}" />`,
                originalText: fullMatch
            });

            return prefix + alias;
        }

        return fullMatch;
    }

    output = output.replace(/(^|\s)(:([a-zA-Z0-9_-]+):)(?=$|\s)/g, (fullMatch, prefix, matchText, name) => replaceEmoticonWithToken(fullMatch, prefix, matchText, name));

    $.each(emoticonPatterns, (name, pattern) => {
        // this might look a bit funny, but since the name isn't contained in the actual match
        // like with the named emoticons, we need to add it in manually
        output = output.replace(pattern, (fullMatch, prefix, matchText) => replaceEmoticonWithToken(fullMatch, prefix, matchText, name));
    });

    return output;
}

function getImagePathForEmoticon(name) {
    return Constants.EMOJI_PATH + '/' + name + '.png';
}

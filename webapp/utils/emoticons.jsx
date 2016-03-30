// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import Constants from './constants.jsx';
import emojis from './emoji.json';

const emoticonPatterns = {
    slightly_smiling_face: /(^|\s)(:-?\))(?=$|\s)/g, // :)
    wink: /(^|\s)(;-?\))(?=$|\s)/g, // ;)
    open_mouth: /(^|\s)(:o)(?=$|\s)/gi, // :o
    scream: /(^|\s)(:-o)(?=$|\s)/gi, // :-o
    smirk: /(^|\s)(:-?])(?=$|\s)/g, // :]
    grinning: /(^|\s)(:-?d)(?=$|\s)/gi, // :D
    stuck_out_tongue_closed_eyes: /(^|\s)(x-d)(?=$|\s)/gi, // x-d
    stuck_out_tongue: /(^|\s)(:-?p)(?=$|\s)/gi, // :p
    rage: /(^|\s)(:-?[\[@])(?=$|\s)/g, // :@
    slightly_frowning_face: /(^|\s)(:-?\()(?=$|\s)/g, // :(
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
    const emoticonMap = new Map();

    for (const emoji of emojis) {
        const unicode = emoji.emoji;

        let filename = '';
        if (unicode) {
            // this is a unicode emoji so the character code determines the file name
            for (let i = 0; i < unicode.length; i += 2) {
                const code = fixedCharCodeAt(unicode, i);

                // ignore variation selector characters
                if (code >= 0xfe00 && code <= 0xfe0f) {
                    continue;
                }

                // some emoji (such as country flags) span multiple unicode characters
                if (i !== 0) {
                    filename += '-';
                }

                filename += pad(code.toString(16));
            }
        } else {
            // this isn't a unicode emoji so the first alias determines the file name
            filename = emoji.aliases[0];
        }

        for (const alias of emoji.aliases) {
            emoticonMap.set(alias, {
                alias,
                path: getImagePathForEmoticon(filename)
            });
        }
    }

    return emoticonMap;
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

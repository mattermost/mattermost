// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EmojiStore from 'stores/emoji_store.jsx';

export const emoticonPatterns = {
    slightly_smiling_face: /(^|\s)(:-?\))(?=$|\s)/g, // :)
    wink: /(^|\s)(;-?\))(?=$|\s)/g, // ;)
    open_mouth: /(^|\s)(:o)(?=$|\s)/gi, // :o
    scream: /(^|\s)(:-o)(?=$|\s)/gi, // :-o
    smirk: /(^|\s)(:-?])(?=$|\s)/g, // :]
    smile: /(^|\s)(:-?d)(?=$|\s)/gi, // :D
    stuck_out_tongue_closed_eyes: /(^|\s)(x-d)(?=$|\s)/gi, // x-d
    stuck_out_tongue: /(^|\s)(:-?p)(?=$|\s)/gi, // :p
    rage: /(^|\s)(:-?[[@])(?=$|\s)/g, // :@
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
    thumbsdown: /(^|\s)(:-1:)(?=$|\s)/g // :-1:
};

export const EMOJI_PATTERN = /(:([a-zA-Z0-9_-]+):)/g;

export function handleEmoticons(text, tokens, emojis) {
    let output = text;

    function replaceEmoticonWithToken(fullMatch, prefix, matchText, name) {
        const index = tokens.size;
        const alias = `$MM_EMOTICON${index}`;

        if (emojis.has(name)) {
            const path = EmojiStore.getEmojiImageUrl(emojis.get(name));

            // we have an image path so we found a matching emoticon
            tokens.set(alias, {
                value: `<span alt="${matchText}" class="emoticon" title="${matchText}" style="background-image:url(${path})"></span>`,
                originalText: fullMatch
            });

            return prefix + alias;
        }

        return fullMatch;
    }

    // match named emoticons like :goat:
    output = output.replace(EMOJI_PATTERN, (fullMatch, matchText, name) => replaceEmoticonWithToken(fullMatch, '', matchText, name));

    // match text smilies like :D
    for (const name of Object.keys(emoticonPatterns)) {
        const pattern = emoticonPatterns[name];

        // this might look a bit funny, but since the name isn't contained in the actual match
        // like with the named emoticons, we need to add it in manually
        output = output.replace(pattern, (fullMatch, prefix, matchText) => replaceEmoticonWithToken(fullMatch, prefix, matchText, name));
    }

    return output;
}

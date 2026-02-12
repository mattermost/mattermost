// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

/**
 * This is Korean for "Test if Hangul is typed well".
 *
 * When testing manually, if you want to type this on a US English Qwerty keyboard with your OS language set to Korean,
 * this can be typed as "gksrmfdl wkf dlqfurehlsmswl xptmxm"
 */
export const koreanTestPhrase = '한글이 잘 입력되는지 테스트';

/**
 * Simulates typing a phrase containing Korean Hangul characters using an Input Method Editor that composes characters
 * from multiple keypresses as the user types. This isn't completely realistic because it's missing keyboard events, but
 * it's sufficient to reproduce composition bugs like MM-66937.
 *
 * This finishes by ending composition on the final character typed, so this can't be used to test anything involving
 * the character that's actively being composed (such as autocompleting partial characters).
 *
 * Note: This only works on Chrome-based browsers because it relies on the Chrome Devtools Protocol (CDP).
 */
export async function typeKoreanWithIme(page: Page, text: string) {
    const client = await page.context().newCDPSession(page);

    for (const decomposed of decomposeKorean(text)) {
        if (decomposed.jama) {
            // # Type the individual jamo

            // The first one is typed as-is
            await client.send('Input.imeSetComposition', {
                selectionStart: -1,
                selectionEnd: -1,
                text: decomposed.jama[0],
            });

            // When you type the second one, the IME combines the two into the resulting character. Instead of reversing
            // the math, we can do that by concatenating them and then normalizing the Unicode.
            await client.send('Input.imeSetComposition', {
                selectionStart: -1,
                selectionEnd: -1,
                text: (decomposed.jama[0] + decomposed.jama[1]).normalize('NFKD'),
            });

            // For the third one, we can't normalize the Unicode because there are some initial and final jama which
            // look identical and normalize to the same value, so just use the original character
            await client.send('Input.imeSetComposition', {
                selectionStart: -1,
                selectionEnd: -1,
                text: decomposed.character,
            });

            // # End composition by inserting the complete character into the textbox
            // Technically, this doesn't actually happen until the user types something else or clicks on the textbox,
            // but it's cleaner to do now since we don't currently support searching for partially composed characters.
            await client.send('Input.insertText', {
                text: decomposed.character,
            });
        } else {
            // # Insert the character
            await client.send('Input.insertText', {
                text: decomposed.character,
            });
        }
    }

    await client.detach();
}

function decomposeKorean(text: string): Array<{character: string; jama?: string[]}> {
    // Adapted from https://useless-factor.blogspot.com/2007/08/unicode-implementers-guide-part-3.html and
    // https://web.archive.org/web/20190512031142/http://www.programminginkorean.com/programming/hangul-in-unicode/composing-syllables-in-unicode/

    // All Korean Hangul characters/syllables are in this range of Unicode
    const hangulStart = 0xac00;
    const hangulEnd = 0xd7a3;

    // Hangul characters are made up of an initial consonant, a medial vowel, and an optional final vowel
    const initial = [
        'ㄱ',
        'ㄲ',
        'ㄴ',
        'ㄷ',
        'ㄸ',
        'ㄹ',
        'ㅁ',
        'ㅂ',
        'ㅃ',
        'ㅅ',
        'ㅆ',
        'ㅇ',
        'ㅈ',
        'ㅉ',
        'ㅊ',
        'ㅋ',
        'ㅌ',
        'ㅍ',
        'ㅎ',
    ];
    const medial = [
        'ㅏ',
        'ㅐ',
        'ㅑ',
        'ㅒ',
        'ㅓ',
        'ㅔ',
        'ㅕ',
        'ㅖ',
        'ㅗ',
        'ㅘ',
        'ㅙ',
        'ㅚ',
        'ㅛ',
        'ㅜ',
        'ㅝ',
        'ㅞ',
        'ㅟ',
        'ㅠ',
        'ㅡ',
        'ㅢ',
        'ㅣ',
    ];
    const final = [
        '',
        'ㄱ',
        'ㄲ',
        'ㄳ',
        'ㄴ',
        'ㄵ',
        'ㄶ',
        'ㄷ',
        'ㄹ',
        'ㄺ',
        'ㄻ',
        'ㄼ',
        'ㄽ',
        'ㄾ',
        'ㄿ',
        'ㅀ',
        'ㅁ',
        'ㅂ',
        'ㅄ',
        'ㅅ',
        'ㅆ',
        'ㅇ',
        'ㅈ',
        'ㅊ',
        'ㅋ',
        'ㅌ',
        'ㅍ',
        'ㅎ',
    ];

    const result = [];

    for (let i = 0; i < text.length; i++) {
        const character = text[i];
        const code = character.charCodeAt(i);

        if (code >= hangulStart && code <= hangulEnd) {
            // This is a Hangul character, so we can break it down into the individual constants and vowel
            const syllableIndex = code - hangulStart;

            // See the linked blog posts for more information on this math
            const initialIndex = Math.floor(syllableIndex / (21 * 28));
            const medialIndex = Math.floor((syllableIndex % (21 * 28)) / 28);
            const finalIndex = syllableIndex % 28;

            const jama = [];
            jama.push(initial[initialIndex]);
            jama.push(medial[medialIndex]);
            if (final[finalIndex]) {
                jama.push(final[finalIndex]);
            }
            result.push({character, jama});
        } else {
            // This is some other character, so just add it separately
            result.push({character});
        }
    }

    return result;
}

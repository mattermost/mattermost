// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EmojiMap from 'utils/emoji_map';
import * as TextFormatting from 'utils/text_formatting';

const emojiMap = new EmojiMap(new Map());

describe('TextFormatting.PhoneNumbers', () => {
    describe('International phone number autolinking', () => {
        it('links international numbers when flag is enabled', () => {
            expect(
                TextFormatting.formatText('+1 555-123-4567', {enablePhoneNumberAutolinkingInternational: true}, emojiMap).trim(),
            ).toBe('<p><a class="theme" href="tel:+15551234567" rel="noreferrer">+1 555-123-4567</a></p>');

            expect(
                TextFormatting.formatText('+44 20 7946 0958', {enablePhoneNumberAutolinkingInternational: true}, emojiMap).trim(),
            ).toBe('<p><a class="theme" href="tel:+442079460958" rel="noreferrer">+44 20 7946 0958</a></p>');

            expect(
                TextFormatting.formatText('+91 98765 43210', {enablePhoneNumberAutolinkingInternational: true}, emojiMap).trim(),
            ).toBe('<p><a class="theme" href="tel:+919876543210" rel="noreferrer">+91 98765 43210</a></p>');
        });

        it('does not link when flag is disabled', () => {
            expect(
                TextFormatting.formatText('+1 555-123-4567', {}, emojiMap).trim(),
            ).toBe('<p>+1 555-123-4567</p>');
        });
    });

    describe('North American phone number autolinking', () => {
        it('links 10-digit North American numbers when flag is enabled', () => {
            expect(
                TextFormatting.formatText('555-123-4567', {enablePhoneNumberAutolinkingNorthAmerican: true}, emojiMap).trim(),
            ).toBe('<p><a class="theme" href="tel:+15551234567" rel="noreferrer">555-123-4567</a></p>');

            expect(
                TextFormatting.formatText('(555) 123-4567', {enablePhoneNumberAutolinkingNorthAmerican: true}, emojiMap).trim(),
            ).toBe('<p><a class="theme" href="tel:+15551234567" rel="noreferrer">(555) 123-4567</a></p>');

            expect(
                TextFormatting.formatText('1-555-123-4567', {enablePhoneNumberAutolinkingNorthAmerican: true}, emojiMap).trim(),
            ).toBe('<p><a class="theme" href="tel:+15551234567" rel="noreferrer">1-555-123-4567</a></p>');
        });

        it('does not link when flag is disabled', () => {
            expect(
                TextFormatting.formatText('555-123-4567', {}, emojiMap).trim(),
            ).toBe('<p>555-123-4567</p>');
        });
    });

    describe('Numbers that should not be linked', () => {
        it('does not link 7-digit numbers', () => {
            expect(
                TextFormatting.formatText(
                    '555-1212',
                    {enablePhoneNumberAutolinkingInternational: true, enablePhoneNumberAutolinkingNorthAmerican: true},
                    emojiMap,
                ).trim(),
            ).toBe('<p>555-1212</p>');
        });

        it('does not link numbers embedded mid-word', () => {
            expect(
                TextFormatting.formatText(
                    'ORDER555-123-4567X',
                    {enablePhoneNumberAutolinkingInternational: true, enablePhoneNumberAutolinkingNorthAmerican: true},
                    emojiMap,
                ).trim(),
            ).toBe('<p>ORDER555-123-4567X</p>');
        });

        it('does not link a number that matches the regex but fails libphonenumber validation', () => {
            // +1 555-123-45 has only 8 national digits; isPossible() returns false for US
            expect(
                TextFormatting.formatText('+1 555-123-45', {enablePhoneNumberAutolinkingInternational: true}, emojiMap).trim(),
            ).toBe('<p>+1 555-123-45</p>');
        });
    });

    describe('Double-linking prevention', () => {
        it('produces exactly one link for a +1 number when both flags are enabled', () => {
            const output = TextFormatting.formatText(
                '+1 555-123-4567',
                {enablePhoneNumberAutolinkingInternational: true, enablePhoneNumberAutolinkingNorthAmerican: true},
                emojiMap,
            ).trim();

            expect(output.match(/<a /g)?.length).toBe(1);
            expect(output).toBe('<p><a class="theme" href="tel:+15551234567" rel="noreferrer">+1 555-123-4567</a></p>');
        });

        it('does not link a +1 number via the NA rule when only NA autolinking is enabled', () => {
            expect(
                TextFormatting.formatText(
                    '+1 555-123-4567',
                    {enablePhoneNumberAutolinkingNorthAmerican: true},
                    emojiMap,
                ).trim(),
            ).toBe('<p>+1 555-123-4567</p>');
        });
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EmojiMap from 'utils/emoji_map';
import * as TextFormatting from 'utils/text_formatting';
const emojiMap = new EmojiMap(new Map());

describe('TextFormatting.Emails', () => {
    it('Valid email addresses', () => {
        expect(TextFormatting.formatText('email@domain.com', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:email@domain.com" rel="noreferrer" target="_blank">email@domain.com</a></p>',
        );

        expect(TextFormatting.formatText('firstname.lastname@domain.com', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:firstname.lastname@domain.com" rel="noreferrer" target="_blank">firstname.lastname@domain.com</a></p>',
        );

        expect(TextFormatting.formatText('email@subdomain.domain.com', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:email@subdomain.domain.com" rel="noreferrer" target="_blank">email@subdomain.domain.com</a></p>',
        );

        expect(TextFormatting.formatText('firstname+lastname@domain.com', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:firstname+lastname@domain.com" rel="noreferrer" target="_blank">firstname+lastname@domain.com</a></p>',
        );

        expect(TextFormatting.formatText('1234567890@domain.com', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:1234567890@domain.com" rel="noreferrer" target="_blank">1234567890@domain.com</a></p>',
        );

        expect(TextFormatting.formatText('email@domain-one.com', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:email@domain-one.com" rel="noreferrer" target="_blank">email@domain-one.com</a></p>',
        );

        expect(TextFormatting.formatText('email@domain.name', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:email@domain.name" rel="noreferrer" target="_blank">email@domain.name</a></p>',
        );

        expect(TextFormatting.formatText('email@domain.co.jp', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:email@domain.co.jp" rel="noreferrer" target="_blank">email@domain.co.jp</a></p>',
        );

        expect(TextFormatting.formatText('firstname-lastname@domain.com', {}, emojiMap).trim()).toBe(
            '<p><a class="theme" href="mailto:firstname-lastname@domain.com" rel="noreferrer" target="_blank">firstname-lastname@domain.com</a></p>',
        );
    });

    it('Should be valid, but matching GitHub', () => {
        expect(TextFormatting.formatText('email@123.123.123.123', {}, emojiMap).trim()).toBe(
            '<p>email@123.123.123.123</p>',
        );

        expect(TextFormatting.formatText('email@[123.123.123.123]', {}, emojiMap).trim()).toBe(
            '<p>email@[123.123.123.123]</p>',
        );

        expect(TextFormatting.formatText('"email"@domain.com', {}, emojiMap).trim()).toBe(
            '<p>&quot;email&quot;@domain.com</p>',
        );
    });

    it('Should be valid, but broken due to Markdown parsing happening before email autolinking', () => {
        expect(TextFormatting.formatText('_______@domain.com', {}, emojiMap).trim()).toBe(
            '<p><strong>___</strong>@domain.com</p>',
        );
    });

    it('Not valid emails', () => {
        expect(TextFormatting.formatText('plainaddress', {}, emojiMap).trim()).toBe(
            '<p>plainaddress</p>',
        );

        expect(TextFormatting.formatText('#@%^%#$@#$@#.com', {}, emojiMap).trim()).toBe(
            '<p>#@%^%#$@#$@#.com</p>',
        );

        expect(TextFormatting.formatText('@domain.com', {}, emojiMap).trim()).toBe(
            '<p>@domain.com</p>',
        );

        expect(TextFormatting.formatText('Joe Smith <email@domain.com>', {}, emojiMap).trim()).toBe(
            '<p>Joe Smith <a class="theme markdown__link" href="mailto:email@domain.com" rel="noreferrer" target="_blank">email@domain.com</a></p>',
        );

        expect(TextFormatting.formatText('email.domain.com', {}, emojiMap).trim()).toBe(
            '<p>email.domain.com</p>',
        );

        expect(TextFormatting.formatText('email.@domain.com', {}, emojiMap).trim()).toBe(
            '<p>email.@domain.com</p>',
        );
    });

    it('Should be invalid, but matching GitHub', () => {
        expect(TextFormatting.formatText('email@domain@domain.com', {}, emojiMap).trim()).toBe(
            '<p>email@<a class="theme" href="mailto:domain@domain.com" rel="noreferrer" target="_blank">domain@domain.com</a></p>',
        );
    });

    it('Should be invalid, but broken', () => {
        expect(TextFormatting.formatText('email@domain@domain.com', {}, emojiMap).trim()).toBe(
            '<p>email@<a class="theme" href="mailto:domain@domain.com" rel="noreferrer" target="_blank">domain@domain.com</a></p>',
        );
    });
});

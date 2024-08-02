// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EmojiMap from 'utils/emoji_map';
import * as Markdown from 'utils/markdown';
import {formatText} from 'utils/text_formatting';

const emojiMap = new EmojiMap(new Map());

describe('Markdown.Imgs', () => {
    it('Inline mage', () => {
        expect(Markdown.format('![Mattermost](/images/icon.png)').trim()).toBe(
            '<p><img src="/images/icon.png" alt="Mattermost" class="markdown-inline-img"></p>',
        );
    });

    it('Image with hover text', () => {
        expect(Markdown.format('![Mattermost](/images/icon.png "Mattermost Icon")').trim()).toBe(
            '<p><img src="/images/icon.png" alt="Mattermost" title="Mattermost Icon" class="markdown-inline-img"></p>',
        );
    });

    it('Image with link', () => {
        expect(Markdown.format('[![Mattermost](../../images/icon-76x76.png)](https://github.com/mattermost/platform)').trim()).toBe(
            '<p><a class="theme markdown__link" href="https://github.com/mattermost/platform" rel="noreferrer" target="_blank"><img src="../../images/icon-76x76.png" alt="Mattermost" class="markdown-inline-img"></a></p>',
        );
    });

    it('Image with width and height', () => {
        expect(Markdown.format('![Mattermost](../../images/icon-76x76.png =50x76 "Mattermost Icon")').trim()).toBe(
            '<p><img src="../../images/icon-76x76.png" alt="Mattermost" title="Mattermost Icon" width="50" height="76" class="markdown-inline-img"></p>',
        );
    });

    it('Image with width', () => {
        expect(Markdown.format('![Mattermost](../../images/icon-76x76.png =50 "Mattermost Icon")').trim()).toBe(
            '<p><img src="../../images/icon-76x76.png" alt="Mattermost" title="Mattermost Icon" width="50" height="auto" class="markdown-inline-img"></p>',
        );
    });
});

describe('Text-formatted inline markdown images', () => {
    it('Not enclosed in a p tag', () => {
        const options = {markdown: true};
        const output = formatText('![Mattermost](/images/icon.png)', options, emojiMap);

        expect(output).toBe(
            '<div class="markdown-inline-img__container"><img src="/images/icon.png" alt="Mattermost" class="markdown-inline-img"></div>',
        );
    });
});

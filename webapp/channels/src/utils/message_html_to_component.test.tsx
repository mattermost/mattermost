// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';

import Constants from 'utils/constants';

import messageHtmlToComponent from 'utils/message_html_to_component';
import * as TextFormatting from 'utils/text_formatting';
import MarkdownImage from 'components/markdown_image';
import AtMention from 'components/at_mention';
import EmojiMap from './emoji_map';

describe('messageHtmlToComponent', () => {
    test('plain text', () => {
        const input = 'Hello, world!';
        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText(input, {}, emojiMap);

        expect(messageHtmlToComponent(html, false, {})).toMatchSnapshot();
    });

    test('latex', () => {
        const input = `This is some latex!
\`\`\`latex
x^2 + y^2 = z^2
\`\`\`

\`\`\`latex
F_m - 2 = F_0 F_1 \\dots F_{m-1}
\`\`\`

That was some latex!`;
        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText(input, {}, emojiMap);

        expect(messageHtmlToComponent(html, false, {})).toMatchSnapshot();
    });

    test('typescript', () => {
        const input = `\`\`\`typescript
const myFunction = () => {
    console.log('This is a meaningful function');
};
\`\`\`
`;
        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText(input, {}, emojiMap);

        expect(messageHtmlToComponent(html, false, {postId: 'randompostid'})).toMatchSnapshot();
    });

    test('html', () => {
        const input = `\`\`\`html
<div>This is a html div</div>
\`\`\`
`;
        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText(input, {}, emojiMap);

        expect(messageHtmlToComponent(html, false, {postId: 'randompostid'})).toMatchSnapshot();
    });

    test('link without enabled tooltip plugins', () => {
        const input = 'lorem ipsum www.dolor.com sit amet';
        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText(input, {}, emojiMap);

        expect(messageHtmlToComponent(html, false, {})).toMatchSnapshot();
    });

    test('link with enabled a tooltip plugin', () => {
        const input = 'lorem ipsum www.dolor.com sit amet';
        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText(input, {}, emojiMap);

        expect(messageHtmlToComponent(html, false, {hasPluginTooltips: true})).toMatchSnapshot();
    });

    test('Inline markdown image', () => {
        const options = {markdown: true};
        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText('![Mattermost](/images/icon.png) and a [link](link)', options, emojiMap);

        const component = messageHtmlToComponent(html, false, {
            hasPluginTooltips: false,
            postId: 'post_id',
            postType: Constants.PostTypes.HEADER_CHANGE,
        });
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(MarkdownImage).prop('imageIsLink')).toBe(false);
    });

    test('Inline markdown image where image is link', () => {
        const options = {markdown: true};
        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText('[![Mattermost](images/icon.png)](images/icon.png)', options, emojiMap);

        const component = messageHtmlToComponent(html, false, {
            hasPluginTooltips: false,
            postId: 'post_id',
            postType: Constants.PostTypes.HEADER_CHANGE,
        });
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(MarkdownImage).prop('imageIsLink')).toBe(true);
    });

    test('At mention', () => {
        const options = {mentionHighlight: true, atMentions: true, mentionKeys: [{key: '@joram'}]};
        const emojiMap = new EmojiMap(new Map());
        let html = TextFormatting.formatText('@joram', options, emojiMap);

        let component = messageHtmlToComponent(html, false, {mentionHighlight: true});
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(AtMention).prop('disableHighlight')).toBe(false);

        options.mentionHighlight = false;

        html = TextFormatting.formatText('@joram', options, emojiMap);

        component = messageHtmlToComponent(html, false, {mentionHighlight: false});
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(AtMention).prop('disableHighlight')).toBe(true);
    });

    test('At mention with group highlight disabled', () => {
        const options = {mentionHighlight: true, atMentions: true, mentionKeys: [{key: '@joram'}], disableGroupHighlight: false};
        const emojiMap = new EmojiMap(new Map());
        let html = TextFormatting.formatText('@developers', options, emojiMap);

        let component = messageHtmlToComponent(html, false, {disableGroupHighlight: false});
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(AtMention).prop('disableGroupHighlight')).toBe(false);

        options.disableGroupHighlight = true;

        html = TextFormatting.formatText('@developers', options, emojiMap);

        component = messageHtmlToComponent(html, false, {disableGroupHighlight: true});
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(AtMention).prop('disableGroupHighlight')).toBe(true);
    });

    test('typescript', () => {
        const input = `Text before typescript codeblock
            \`\`\`typescript
            const myFunction = () => {
                console.log('This is a test function');
            };
            \`\`\`
            text after typescript block`;

        const emojiMap = new EmojiMap(new Map());
        const html = TextFormatting.formatText(input, {}, emojiMap);

        expect(messageHtmlToComponent(html, false, {})).toMatchSnapshot();
    });
});

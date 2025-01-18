// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';

import AtMention from 'components/at_mention';
import MarkdownImage from 'components/markdown_image';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import EmojiMap from 'utils/emoji_map';
import messageHtmlToComponent, {getImageMetadata} from 'utils/message_html_to_component';
import * as TextFormatting from 'utils/text_formatting';

const emptyEmojiMap = new EmojiMap(new Map());

describe('messageHtmlToComponent', () => {
    test('plain text', () => {
        const input = 'Hello, world!';
        const html = TextFormatting.formatText(input, {}, emptyEmojiMap);

        expect(messageHtmlToComponent(html)).toMatchSnapshot();
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
        const html = TextFormatting.formatText(input, {}, emptyEmojiMap);

        expect(messageHtmlToComponent(html)).toMatchSnapshot();
    });

    test('typescript', () => {
        const input = `\`\`\`typescript
const myFunction = () => {
    console.log('This is a meaningful function');
};
\`\`\`
`;
        const html = TextFormatting.formatText(input, {}, emptyEmojiMap);

        expect(messageHtmlToComponent(html, {postId: 'randompostid'})).toMatchSnapshot();
    });

    test('html', () => {
        const input = `\`\`\`html
<div>This is a html div</div>
\`\`\`
`;
        const html = TextFormatting.formatText(input, {}, emptyEmojiMap);

        expect(messageHtmlToComponent(html, {postId: 'randompostid'})).toMatchSnapshot();
    });

    test('link without enabled tooltip plugins', () => {
        const input = 'lorem ipsum www.dolor.com sit amet';
        const html = TextFormatting.formatText(input, {}, emptyEmojiMap);

        expect(messageHtmlToComponent(html)).toMatchSnapshot();
    });

    test('link with enabled a tooltip plugin', () => {
        const input = 'lorem ipsum www.dolor.com sit amet';
        const html = TextFormatting.formatText(input, {}, emptyEmojiMap);

        expect(messageHtmlToComponent(html, {hasPluginTooltips: true})).toMatchSnapshot();
    });

    test('Inline markdown image', () => {
        const options = {markdown: true};
        const html = TextFormatting.formatText('![Mattermost](/images/icon.png) and a [link](link)', options, emptyEmojiMap);

        const component = messageHtmlToComponent(html, {
            hasPluginTooltips: false,
            postId: 'post_id',
            postType: Constants.PostTypes.HEADER_CHANGE,
        });
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(MarkdownImage).prop('imageIsLink')).toBe(false);
    });

    test('Inline markdown image where image is link', () => {
        const options = {markdown: true};
        const html = TextFormatting.formatText('[![Mattermost](images/icon.png)](images/icon.png)', options, emptyEmojiMap);

        const component = messageHtmlToComponent(html, {
            hasPluginTooltips: false,
            postId: 'post_id',
            postType: Constants.PostTypes.HEADER_CHANGE,
        });
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(MarkdownImage).prop('imageIsLink')).toBe(true);
    });

    test('At mention', () => {
        const options = {mentionHighlight: true, atMentions: true, mentionKeys: [{key: '@joram'}]};
        let html = TextFormatting.formatText('@joram', options, emptyEmojiMap);

        let component = messageHtmlToComponent(html, {mentionHighlight: true});
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(AtMention).prop('disableHighlight')).toBe(false);

        options.mentionHighlight = false;

        html = TextFormatting.formatText('@joram', options, emptyEmojiMap);

        component = messageHtmlToComponent(html, {mentionHighlight: false});
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(AtMention).prop('disableHighlight')).toBe(true);
    });

    test('At mention with group highlight disabled', () => {
        const options: TextFormatting.TextFormattingOptions = {mentionHighlight: true, atMentions: true, mentionKeys: [{key: '@joram'}]};
        let html = TextFormatting.formatText('@developers', options, emptyEmojiMap);

        let component = messageHtmlToComponent(html, {disableGroupHighlight: false});
        expect(component).toMatchSnapshot();
        expect(shallow(component).find(AtMention).prop('disableGroupHighlight')).toBe(false);

        options.disableGroupHighlight = true;

        html = TextFormatting.formatText('@developers', options, emptyEmojiMap);

        component = messageHtmlToComponent(html, {disableGroupHighlight: true});
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

        const html = TextFormatting.formatText(input, {}, emptyEmojiMap);

        expect(messageHtmlToComponent(html)).toMatchSnapshot();
    });

    describe('emojis', () => {
        test('should render valid named emojis as spans with background images', () => {
            const input = 'These are emojis: :taco: :astronaut:';

            const {container} = renderWithContext(messageHtmlToComponent(TextFormatting.formatText(input, {}, emptyEmojiMap)));

            expect(screen.getByTestId('postEmoji.:taco:')).toBeInTheDocument();
            expect(screen.getByTestId('postEmoji.:taco:').getAttribute('style')).toContain('background-image');
            expect(screen.getByTestId('postEmoji.:astronaut:')).toBeInTheDocument();
            expect(screen.getByTestId('postEmoji.:astronaut:').getAttribute('style')).toContain('background-image');

            expect(container).toHaveTextContent('These are emojis: :taco: :astronaut:');
        });

        test('should render invalid named emojis as spans with background images', () => {
            const input = 'These are emojis: :fake: :notAnEmoji:';

            const {container} = renderWithContext(messageHtmlToComponent(TextFormatting.formatText(input, {}, emptyEmojiMap)));

            expect(screen.queryByTestId('postEmoji.:taco:')).not.toBeInTheDocument();
            expect(screen.queryByTestId('postEmoji.:astronaut:')).not.toBeInTheDocument();

            expect(container).toHaveTextContent('These are emojis: :fake: :notAnEmoji:');
        });

        test('should render supported unicode emojis as spans with background images', () => {
            const input = 'These are emojis: 🌮 🧑‍🚀';

            const {container} = renderWithContext(messageHtmlToComponent(TextFormatting.formatText(input, {}, emptyEmojiMap)));

            expect(screen.getByTestId('postEmoji.:taco:')).toBeInTheDocument();
            expect(screen.getByTestId('postEmoji.:taco:').getAttribute('style')).toContain('background-image');
            expect(screen.getByTestId('postEmoji.:astronaut:')).toBeInTheDocument();
            expect(screen.getByTestId('postEmoji.:astronaut:').getAttribute('style')).toContain('background-image');

            expect(container).toHaveTextContent('These are emojis: 🌮 🧑‍🚀');
        });
    });
});

describe('getImageMetadata', () => {
    test('undefined imagesMetadata', () => {
        const imageSrc = 'https://test.com/media/1234.gif';
        const imagesMetada = undefined;

        expect(getImageMetadata(imagesMetada, imageSrc)).toBe(undefined);
    });
    test('undefined imageSrc', () => {
        const imageSrc = undefined;
        const imageMetadata = {width: 200, height: 200};
        const imagesMetada = {'https://test.com/media/1234.gif': imageMetadata};

        expect(getImageMetadata(imagesMetada, imageSrc)).toBe(undefined);
    });
    test('matching imageSrc', () => {
        const imageSrc = 'https://test.com/media/1234.gif';
        const imageMetadata = {width: 200, height: 200};
        const imagesMetada = {[imageSrc]: imageMetadata};

        expect(getImageMetadata(imagesMetada, imageSrc)).toBe(imageMetadata);
    });
    test('proxied imageSrc', () => {
        const imageSrc = 'https://test.com/media/1234.gif';
        const proxiedImageSrc = `https://test.proxy/api/v4/image?${new URLSearchParams({url: imageSrc})}`;
        const imageMetadata = {width: 200, height: 200};
        const imagesMetada = {[imageSrc]: imageMetadata};

        expect(getImageMetadata(imagesMetada, proxiedImageSrc)).toBe(imageMetadata);
    });
    test('proxied and encoded ampersand imageSrc', () => {
        const imageSrc = 'https://test.com/media/1234.gif?param1=123&param2=456';
        const proxiedImageSrc = `https://test.proxy/api/v4/image?${new URLSearchParams({url: imageSrc.replace(/&/g, '&amp;')})}`;
        const imageMetadata = {width: 200, height: 200};
        const imagesMetada = {[imageSrc]: imageMetadata};

        expect(getImageMetadata(imagesMetada, proxiedImageSrc)).toBe(imageMetadata);
    });
});

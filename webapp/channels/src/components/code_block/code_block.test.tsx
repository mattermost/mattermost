// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount, shallow} from 'enzyme';
import React from 'react';
import {act} from 'react-dom/test-utils';
import {IntlProvider} from 'react-intl';

import CodeBlock from './code_block';

import type {ReactWrapper} from 'enzyme';

const actImmediate = (wrapper: ReactWrapper) =>
    act(
        () =>
            new Promise<void>((resolve) => {
                setImmediate(() => {
                    wrapper.update();
                    resolve();
                });
            }),
    );

describe('codeBlock', () => {
    test('should render typescript code block before syntax highlighting', async () => {
        const language = 'typescript';
        const input = `\`\`\`${language}
const myFunction = () => {
    console.log('This is a meaningful function');
};
\`\`\`
`;

        const wrapper = shallow(
            <CodeBlock
                code={input}
                language={language}
            />,
        );

        const languageHeader = wrapper.find('span.post-code__language').text();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toEqual('TypeScript');
        expect(lineNumbersDiv).toBeTruthy();

        expect(wrapper).toMatchSnapshot();
    });

    test('should render typescript code block after syntax highlighting', async () => {
        const language = 'typescript';
        const input = `\`\`\`${language}
const myFunction = () => {
    console.log('This is a meaningful function');
};
\`\`\`
`;

        const wrapper = mount(
            <IntlProvider locale='en'>
                <CodeBlock
                    code={input}
                    language={language}
                />
            </IntlProvider>,
        );
        await actImmediate(wrapper);

        const languageHeader = wrapper.find('span.post-code__language').text();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toEqual('TypeScript');
        expect(lineNumbersDiv).toBeTruthy();

        expect(wrapper).toMatchSnapshot();
    });

    test('should render html code block with proper indentation before syntax highlighting', () => {
        const language = 'html';
        const input = `\`\`\`${language}
<div className='myClass'>
  <a href='https://randomgibberishurl.com'>ClickMe</a>
</div>
\`\`\`
`;

        const wrapper = shallow(
            <CodeBlock
                code={input}
                language={language}
            />,
        );

        const languageHeader = wrapper.find('span.post-code__language').text();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toEqual('HTML, XML');
        expect(lineNumbersDiv).toBeTruthy();
        expect(wrapper).toMatchSnapshot();
    });

    test('should render html code block with proper indentation after syntax highlighting', async () => {
        const language = 'html';
        const input = `\`\`\`${language}
<div className='myClass'>
  <a href='https://randomgibberishurl.com'>ClickMe</a>
</div>
\`\`\`
`;

        const wrapper = mount(
            <IntlProvider locale='en'>
                <CodeBlock
                    code={input}
                    language={language}
                />
            </IntlProvider>,
        );
        await actImmediate(wrapper);

        const languageHeader = wrapper.find('span.post-code__language').text();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toEqual('HTML, XML');
        expect(lineNumbersDiv).toBeTruthy();
        expect(wrapper).toMatchSnapshot();
    });

    test('should render unknown language before syntax highlighting', () => {
        const language = 'unknownLanguage';
        const input = `\`\`\`${language}
this is my unknown language
it shouldn't highlight, it's just garbage
\`\`\`
`;

        const wrapper = shallow(
            <CodeBlock
                code={input}
                language={language}
            />,
        );

        const languageHeader = wrapper.find('span.post-code__language').exists();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toBeFalsy();
        expect(lineNumbersDiv).toBeFalsy();
        expect(wrapper).toMatchSnapshot();
    });

    test('should render unknown language after syntax highlighting', async () => {
        const language = 'unknownLanguage';
        const input = `\`\`\`${language}
this is my unknown language
it shouldn't highlight, it's just garbage
\`\`\`
`;

        const wrapper = mount(
            <IntlProvider locale='en'>
                <CodeBlock
                    code={input}
                    language={language}
                />
            </IntlProvider>,
        );
        await actImmediate(wrapper);

        const languageHeader = wrapper.find('span.post-code__language').exists();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toBeFalsy();
        expect(lineNumbersDiv).toBeFalsy();
        expect(wrapper).toMatchSnapshot();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';
import {IntlProvider} from 'react-intl';
import {Provider as ReduxProvider} from 'react-redux';

import type {ReactWrapper} from 'enzyme';
import {mount} from 'enzyme';

import mockStore from 'tests/test_store';

import CodeBlock from './code_block';

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
    const state = {
        plugins: {components: {CodeBlockAction: []}},
    };
    const store = mockStore(state);

    test('should render typescript code block before syntax highlighting', async () => {
        const language = 'typescript';
        const input = `\`\`\`${language}
const myFunction = () => {
    console.log('This is a meaningful function');
};
\`\`\`
`;

        const wrapper = mount(
            <ReduxProvider store={store}>
                <IntlProvider locale='en'>
                    <CodeBlock
                        code={input}
                        language={language}
                    />
                </IntlProvider>
            </ReduxProvider>,
        );
        await actImmediate(wrapper);

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
            <ReduxProvider store={store}>
                <IntlProvider locale='en'>
                    <CodeBlock
                        code={input}
                        language={language}
                    />
                </IntlProvider>
            </ReduxProvider>,
        );
        await actImmediate(wrapper);

        const languageHeader = wrapper.find('span.post-code__language').text();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toEqual('TypeScript');
        expect(lineNumbersDiv).toBeTruthy();

        expect(wrapper).toMatchSnapshot();
    });

    test('should render html code block with proper indentation before syntax highlighting', async () => {
        const language = 'html';
        const input = `\`\`\`${language}
<div className='myClass'>
  <a href='https://randomgibberishurl.com'>ClickMe</a>
</div>
\`\`\`
`;

        const wrapper = mount(
            <ReduxProvider store={store}>
                <IntlProvider locale='en'>
                    <CodeBlock
                        code={input}
                        language={language}
                    />
                </IntlProvider>
            </ReduxProvider>,
        );
        await actImmediate(wrapper);

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
            <ReduxProvider store={store}>
                <IntlProvider locale='en'>
                    <CodeBlock
                        code={input}
                        language={language}
                    />
                </IntlProvider>
            </ReduxProvider>,
        );
        await actImmediate(wrapper);

        const languageHeader = wrapper.find('span.post-code__language').text();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toEqual('HTML, XML');
        expect(lineNumbersDiv).toBeTruthy();
        expect(wrapper).toMatchSnapshot();
    });

    test('should render unknown language before syntax highlighting', async () => {
        const language = 'unknownLanguage';
        const input = `\`\`\`${language}
this is my unknown language
it shouldn't highlight, it's just garbage
\`\`\`
`;

        const wrapper = mount(
            <ReduxProvider store={store}>
                <IntlProvider locale='en'>
                    <CodeBlock
                        code={input}
                        language={language}
                    />
                </IntlProvider>
            </ReduxProvider>,
        );
        await actImmediate(wrapper);

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
            <ReduxProvider store={store}>
                <IntlProvider locale='en'>
                    <CodeBlock
                        code={input}
                        language={language}
                    />
                </IntlProvider>
            </ReduxProvider>,
        );
        await actImmediate(wrapper);

        const languageHeader = wrapper.find('span.post-code__language').exists();
        const lineNumbersDiv = wrapper.find('.post-code__line-numbers').exists();

        expect(languageHeader).toBeFalsy();
        expect(lineNumbersDiv).toBeFalsy();
        expect(wrapper).toMatchSnapshot();
    });
});

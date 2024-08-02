// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';

import CodeBlock from './code_block';

const actImmediate = () =>
    act(
        () =>
            new Promise<void>((resolve) => {
                setImmediate(() => {
                    resolve();
                });
            }),
    );

describe('codeBlock', () => {
    test('should render typescript code block with syntax highlighting', async () => {
        const language = 'typescript';
        const input = `const myFunction = () => {
    console.log('This is a meaningful function');
};`;

        const {container} = renderWithContext(
            <CodeBlock
                code={input}
                language={language}
            />,
        );

        expect(screen.getByText('TypeScript')).toBeInTheDocument();
        expect(container.querySelector('.post-code__line-numbers')).toBeInTheDocument();

        expect(container.querySelector('.hljs-keyword')).not.toBeInTheDocument();

        // Wait for highlight.js to finish loading
        await actImmediate();

        expect(screen.getByText('TypeScript')).toBeInTheDocument();
        expect(container.querySelector('.post-code__line-numbers')).toBeInTheDocument();

        expect(container.querySelector('.hljs-keyword')).toBeInTheDocument();
    });

    test('should render unknown language before syntax highlighting', async () => {
        const language = 'unknownLanguage';
        const input = `this is my unknown language
it shouldn't highlight, it's just garbage`;

        const {container} = renderWithContext(
            <CodeBlock
                code={input}
                language={language}
            />,
        );

        expect(screen.queryByText('unknownLanguage')).toBeFalsy();
        expect(container.querySelector('.post-code__line-numbers')).toBeFalsy();

        // Wait for highlight.js to finish loading
        await actImmediate();

        expect(screen.queryByText('unknownLanguage')).toBeFalsy();
        expect(container.querySelector('.post-code__line-numbers')).toBeFalsy();
    });

    test('MM-54468 should not add an extra space before highlighted code in search results', async () => {
        const language = '';
        const input = 'foo foo foo foo';
        const searchedInput = '<span class="search-highlight">foo</span> <span class="search-highlight">foo</span> ' +
            '<span class="search-highlight">foo</span> <span class="search-highlight">foo</span>';

        const {container} = renderWithContext(
            <CodeBlock
                code={input}
                language={language}
                searchedContent={searchedInput}
            />,
        );

        // There shouldn't be a space between the overlay with search highlighting and the code below
        expect(container.querySelector('code')).toHaveTextContent('foo foo foo foofoo foo foo foo');
        expect(container.querySelector('code')).not.toHaveTextContent('foo foo foo foo foo foo foo foo');

        // Wait for highlight.js to finish loading
        await actImmediate();

        expect(container.querySelector('code')).toHaveTextContent('foo foo foo foofoo foo foo foo');
        expect(container.querySelector('code')).not.toHaveTextContent('foo foo foo foo foo foo foo foo');
    });
});

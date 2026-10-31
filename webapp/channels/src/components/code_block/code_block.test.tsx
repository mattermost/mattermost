// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {installMessageChannel} from 'tests/helpers/message_channel';
import {testPluginComponentErrorHandling} from 'tests/helpers/plugin_error_handling';
import {act, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import * as SyntaxHighlighting from 'utils/syntax_highlighting';

import CodeBlock from './code_block';

describe('codeBlock', () => {
    installMessageChannel();

    let highlightSpy: jest.SpyInstance;

    beforeEach(() => {
        highlightSpy = jest.spyOn(SyntaxHighlighting, 'highlight');
    });

    afterEach(() => {
        highlightSpy.mockRestore();
    });

    const waitForHighlightCalls = () => act(async () => {
        await Promise.all(highlightSpy.mock.results.map((result) => result.value));
    });

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

        await waitFor(() => {
            expect(container.querySelector('.hljs-keyword')).toBeInTheDocument();
        });

        expect(screen.getByText('TypeScript')).toBeInTheDocument();
        expect(container.querySelector('.post-code__line-numbers')).toBeInTheDocument();
    });

    test('should highlight every code block when several are rendered at once', async () => {
        const {container} = renderWithContext(
            <>
                <CodeBlock
                    code='const first = 1;'
                    language='typescript'
                />
                <CodeBlock
                    code='const second = 2;'
                    language='typescript'
                />
                <CodeBlock
                    code='const third = 3;'
                    language='typescript'
                />
            </>,
        );

        await waitFor(() => {
            expect(container.querySelectorAll('code .hljs-keyword')).toHaveLength(3);
        });
    });

    test('should not show the language or line numbers for code too long to highlight', async () => {
        const input = 'const value = 1;\n'.repeat(400);

        const {container} = renderWithContext(
            <CodeBlock
                code={input}
                language='typescript'
            />,
        );

        expect(screen.queryByText('TypeScript')).not.toBeInTheDocument();
        expect(container.querySelector('.post-code__line-numbers')).not.toBeInTheDocument();

        await waitForHighlightCalls();

        expect(highlightSpy).toHaveBeenCalled();
        expect(container.querySelector('.hljs-keyword')).not.toBeInTheDocument();
        expect(screen.queryByText('TypeScript')).not.toBeInTheDocument();
        expect(container.querySelector('.post-code__line-numbers')).not.toBeInTheDocument();
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

        await waitForHighlightCalls();

        expect(highlightSpy).toHaveBeenCalled();
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

        await waitForHighlightCalls();

        expect(highlightSpy).toHaveBeenCalled();
        expect(container.querySelector('code')).toHaveTextContent('foo foo foo foofoo foo foo foo');
        expect(container.querySelector('code')).not.toHaveTextContent('foo foo foo foo foo foo foo foo');
    });

    testPluginComponentErrorHandling((pluginComponent) => {
        renderWithContext(
            <CodeBlock
                code='some code'
                language='txt'
            />,
            {
                plugins: {
                    components: {
                        CodeBlockAction: [pluginComponent],
                    },
                },
            } as any,
        );
    });
});

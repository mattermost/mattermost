// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {testPluginComponentErrorHandling} from 'tests/helpers/plugin_error_handling';
import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import * as Utils from 'utils/utils';

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

    describe('markdown code blocks', () => {
        const markdown = '# Heading\n\nSome **bold** text';

        beforeEach(() => {
            localStorage.clear();
        });

        test.each(['markdown', 'md', 'mkd', 'MD'])('should show the toggle and default to raw for %s', async (language) => {
            const {container} = renderWithContext(
                <CodeBlock
                    code={markdown}
                    language={language}
                />,
            );
            await actImmediate();

            expect(screen.getByRole('button', {name: 'Raw'})).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByRole('button', {name: 'Rendered'})).toHaveAttribute('aria-pressed', 'false');
            expect(container.querySelector('.hljs code')).toBeInTheDocument();
            expect(container.querySelector('.post-code')).toHaveClass('post-code--wrap');
            expect(container.querySelector('.post-code__line-numbers')).not.toBeInTheDocument();
            expect(screen.queryByRole('heading', {name: 'Heading'})).not.toBeInTheDocument();
        });

        test.each(['typescript', 'xml', 'html', ''])('should not show the toggle for %p', async (language) => {
            renderWithContext(
                <CodeBlock
                    code={markdown}
                    language={language}
                />,
            );
            await actImmediate();

            expect(screen.queryByRole('group', {name: 'Markdown view'})).not.toBeInTheDocument();
        });

        test('should render the markdown when toggled and switch back to raw', async () => {
            const {container} = renderWithContext(
                <CodeBlock
                    code={markdown}
                    language='markdown'
                />,
            );
            await actImmediate();

            await userEvent.click(screen.getByRole('button', {name: 'Rendered'}));

            expect(screen.getByRole('heading', {level: 1, name: 'Heading'})).toBeInTheDocument();
            expect(screen.getByText('bold').tagName).toBe('STRONG');
            expect(screen.getByRole('button', {name: 'Rendered'})).toHaveAttribute('aria-pressed', 'true');
            expect(container.querySelector('.post-code__rendered')).toBeInTheDocument();
            expect(container.querySelector('.hljs')).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Raw'}));

            expect(screen.queryByRole('heading', {name: 'Heading'})).not.toBeInTheDocument();
            expect(container.querySelector('.hljs code')).toBeInTheDocument();
            expect(container.querySelector('.post-code__rendered')).not.toBeInTheDocument();
        });

        test('should keep copying the raw source while rendered', async () => {
            const spy = jest.spyOn(Utils, 'copyToClipboard');
            renderWithContext(
                <CodeBlock
                    code={markdown}
                    language='markdown'
                />,
            );
            await actImmediate();

            await userEvent.click(screen.getByRole('button', {name: 'Rendered'}));
            await userEvent.click(screen.getByLabelText('Copy code'));

            expect(spy).toHaveBeenCalledWith(markdown);
        });

        test('should apply the remembered choice to later code blocks', async () => {
            const first = renderWithContext(
                <CodeBlock
                    code={markdown}
                    language='markdown'
                />,
            );
            await actImmediate();
            await userEvent.click(screen.getByRole('button', {name: 'Rendered'}));
            first.unmount();

            renderWithContext(
                <CodeBlock
                    code={markdown}
                    language='markdown'
                />,
            );
            await actImmediate();

            expect(screen.getByRole('heading', {level: 1, name: 'Heading'})).toBeInTheDocument();
        });

        test('should not offer a second toggle for a markdown fence inside rendered markdown', async () => {
            renderWithContext(
                <CodeBlock
                    code={'Outer\n\n```markdown\n# Inner\n```'}
                    language='markdown'
                />,
            );
            await actImmediate();

            await userEvent.click(screen.getByRole('button', {name: 'Rendered'}));
            await actImmediate();

            expect(screen.getAllByRole('group', {name: 'Markdown view'})).toHaveLength(1);
            expect(screen.queryByRole('heading', {name: 'Inner'})).not.toBeInTheDocument();
        });
    });
});

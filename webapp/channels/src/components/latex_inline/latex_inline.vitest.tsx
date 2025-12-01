// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LatexInline from 'components/latex_inline/latex_inline';

import {renderWithIntl, screen, waitFor} from 'tests/vitest_react_testing_utils';

vi.mock('katex', () => ({
    default: {
        renderToString: (content: string, options: {throwOnError: boolean}) => {
            // Simulate KaTeX behavior - throw error for malformed LaTeX when braces are unbalanced
            if (content.includes('{') && !content.includes('}')) {
                if (options.throwOnError) {
                    throw new Error('KaTeX parse error');
                }

                // When throwOnError is false, KaTeX returns error HTML
                return `<span class="katex-error" style="color:#cc0000" title="ParseError: KaTeX parse error: Expected '}', got 'EOF' at end of input: ${content}">${content}</span>`;
            }
            return `<span class="katex"><span class="katex-html">${content}</span></span>`;
        },
    },
}));

describe('components/LatexInline', () => {
    const defaultProps = {
        content: 'e^{i\\pi} + 1 = 0',
        enableInlineLatex: true,
    };

    test('should match snapshot', async () => {
        renderWithIntl(<LatexInline {...defaultProps}/>);

        // Wait for katex to load (component switches from latex-disabled to latex-enabled)
        await waitFor(() => {
            expect(screen.getByTestId('latex-enabled')).toBeInTheDocument();
        });

        // Verify the katex output is rendered
        const element = screen.getByTestId('latex-enabled');
        expect(element).toHaveClass('post-body--code', 'inline-tex');
        expect(element.querySelector('.katex')).toBeInTheDocument();
    });

    test('latex is disabled', async () => {
        const props = {
            ...defaultProps,
            enableInlineLatex: false,
        };

        renderWithIntl(<LatexInline {...props}/>);

        // When disabled, it immediately shows the disabled version (no async loading)
        const element = screen.getByTestId('latex-disabled');
        expect(element).toBeInTheDocument();
        expect(element).toHaveClass('post-body--code', 'inline-tex');
        expect(element.textContent).toBe('$e^{i\\pi} + 1 = 0$');
    });

    test('error in katex', async () => {
        const props = {
            content: 'e^{i\\pi + 1 = 0', // Missing closing brace
            enableInlineLatex: true,
        };

        renderWithIntl(<LatexInline {...props}/>);

        // Wait for katex to load and render the error
        await waitFor(() => {
            expect(screen.getByTestId('latex-enabled')).toBeInTheDocument();
        });

        // Verify error is shown
        const element = screen.getByTestId('latex-enabled');
        expect(element.querySelector('.katex-error')).toBeInTheDocument();
    });
});

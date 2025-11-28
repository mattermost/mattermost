// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import LatexInline from 'components/latex_inline/latex_inline';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

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
        let container: HTMLElement | undefined;

        await act(async () => {
            const result = renderWithIntl(<LatexInline {...defaultProps}/>);
            container = result.container;
        });
        expect(container).toMatchSnapshot();
    });

    test('latex is disabled', async () => {
        const props = {
            ...defaultProps,
            enableInlineLatex: false,
        };

        let container: HTMLElement | undefined;

        await act(async () => {
            const result = renderWithIntl(<LatexInline {...props}/>);
            container = result.container;
        });
        expect(container).toMatchSnapshot();
    });

    test('error in katex', async () => {
        const props = {
            content: 'e^{i\\pi + 1 = 0',
            enableInlineLatex: true,
        };

        let container: HTMLElement | undefined;

        await act(async () => {
            const result = renderWithIntl(<LatexInline {...props}/>);
            container = result.container;
        });
        expect(container).toMatchSnapshot();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';
import {describe, test, expect} from 'vitest';

import LatexInline from 'components/latex_inline/latex_inline';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

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

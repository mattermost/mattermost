// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LatexInline from 'components/latex_inline/latex_inline';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, waitFor} from 'tests/react_testing_utils';

describe('components/LatexInline', () => {
    const defaultProps = {
        content: 'e^{i\\pi} + 1 = 0',
        enableInlineLatex: true,
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(withIntl(<LatexInline {...defaultProps}/>));
        await waitFor(() => {
            expect(container.querySelector('[data-testid="latex-enabled"]')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('latex is disabled', () => {
        const props = {
            ...defaultProps,
            enableInlineLatex: false,
        };

        const {container} = renderWithContext(withIntl(<LatexInline {...props}/>));
        expect(container).toMatchSnapshot();
    });

    test('error in katex', async () => {
        const props = {
            content: 'e^{i\\pi + 1 = 0',
            enableInlineLatex: true,
        };

        const {container} = renderWithContext(withIntl(<LatexInline {...props}/>));
        await waitFor(() => {
            expect(container.querySelector('[data-testid="latex-enabled"]')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});

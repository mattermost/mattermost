// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import LatexBlock from 'components/latex_block/latex_block';

import {withIntl} from 'tests/helpers/intl-test-helper';

describe('components/LatexBlock', () => {
    const defaultProps = {
        content: '```latex e^{i\\pi} + 1 = 0```',
        enableLatex: true,
    };

    test('should match snapshot', async () => {
        render(<LatexBlock {...defaultProps}/>);
        const wrapper = await screen.findAllByTestId('latex-enabled');
        expect(wrapper.length).toBe(1);
        expect(wrapper.at(0)).toMatchSnapshot();
    });

    test('latex is disabled', async () => {
        const props = {
            ...defaultProps,
            enableLatex: false,
        };

        render(<LatexBlock {...props}/>);
        const wrapper = await screen.findAllByTestId('latex-disabled');
        expect(wrapper.length).toBe(1);
        expect(wrapper.at(0)).toMatchSnapshot();
    });

    test('error in katex', async () => {
        const props = {
            content: '```latex e^{i\\pi + 1 = 0```',
            enableLatex: true,
        };

        render(withIntl(<LatexBlock {...props}/>));
        const wrapper = await screen.findAllByTestId('latex-enabled');
        expect(wrapper.length).toBe(1);
        expect(wrapper.at(0)).toMatchSnapshot();
    });
});

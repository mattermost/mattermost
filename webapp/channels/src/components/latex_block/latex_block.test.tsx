// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, act} from '@testing-library/react';
import React from 'react';

import LatexBlock from 'components/latex_block/latex_block';

import {withIntl} from 'tests/helpers/intl-test-helper';

describe('components/LatexBlock', () => {
    const defaultProps = {
        content: '```latex e^{i\\pi} + 1 = 0```',
        enableLatex: true,
    };

    test('should match snapshot', async () => {
        await act(async () => {
            render(<LatexBlock {...defaultProps}/>);
        });
        const wrapper = await screen.findAllByTestId('latex-enabled');
        expect(wrapper.at(0)).toMatchSnapshot();
    });

    test('latex is disabled', async () => {
        const props = {
            ...defaultProps,
            enableLatex: false,
        };

        await act(async () => {
            render(<LatexBlock {...props}/>);
        });
        const wrapper = await screen.findAllByTestId('latex-disabled');
        expect(wrapper.at(0)).toMatchSnapshot();
    });

    test('error in katex', async () => {
        const props = {
            content: '```latex e^{i\\pi + 1 = 0```',
            enableLatex: true,
        };

        await act(async () => {
            render(withIntl(<LatexBlock {...props}/>));
        });
        const wrapper = await screen.findAllByTestId('latex-error');
        expect(wrapper.at(0)).toMatchSnapshot();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import LatexBlock from 'components/latex_block/latex_block';

import {act, renderWithContext} from 'tests/react_testing_utils';

const actImmediate = () =>
    act(
        () =>
            new Promise<void>((resolve) => {
                setImmediate(() => {
                    resolve();
                });
            }),
    );

describe('components/LatexBlock', () => {
    const defaultProps = {
        content: '```latex e^{i\\pi} + 1 = 0```',
        enableLatex: true,
    };

    test('should match snapshot', async () => {
        renderWithContext(<LatexBlock {...defaultProps}/>);
        const wrapper = await screen.findAllByTestId('latex-enabled');
        expect(wrapper.length).toBe(1);
        expect(wrapper.at(0)).toMatchSnapshot();
    });

    test('latex is disabled', async () => {
        const props = {
            ...defaultProps,
            enableLatex: false,
        };

        const {container} = renderWithContext(<LatexBlock {...props}/>);

        expect(screen.getByText('LaTeX')).toBeInTheDocument();
        expect(container.querySelector('.post-code__line-numbers')).toBeInTheDocument();

        await actImmediate();
    });

    test('error in katex', async () => {
        const props = {
            content: '```latex e^{i\\pi + 1 = 0```',
            enableLatex: true,
        };

        renderWithContext(<LatexBlock {...props}/>);
        const wrapper = await screen.findAllByTestId('latex-enabled');
        expect(wrapper.length).toBe(1);
        expect(wrapper.at(0)).toMatchSnapshot();
    });
});

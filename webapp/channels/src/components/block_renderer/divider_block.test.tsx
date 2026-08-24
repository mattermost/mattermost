// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {MmBlocksChildLayoutContext} from './context';
import {DividerBlock} from './divider_block';

describe('DividerBlock', () => {
    it('renders horizontal rule in column layout', () => {
        const {container} = renderWithContext(
            <MmBlocksChildLayoutContext.Provider value='column'>
                <DividerBlock/>
            </MmBlocksChildLayoutContext.Provider>,
        );

        expect(container.querySelector('hr.mm-blocks-divider')).toBeInTheDocument();
        expect(container.querySelector('.mm-blocks-divider--vertical')).not.toBeInTheDocument();
    });

    it('renders vertical separator in row layout', () => {
        renderWithContext(
            <MmBlocksChildLayoutContext.Provider value='row'>
                <DividerBlock/>
            </MmBlocksChildLayoutContext.Provider>,
        );

        const separator = screen.getByRole('separator');
        expect(separator).toHaveClass('mm-blocks-divider--vertical');
        expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import MaskedChip from './masked_chip';

describe('MaskedChip', () => {
    test('renders the masked token text', () => {
        renderWithContext(<MaskedChip/>);
        expect(screen.getByText('••••••••')).toBeInTheDocument();
    });

    test('has role="img" for accessibility', () => {
        renderWithContext(<MaskedChip/>);
        const chip = screen.getByRole('img');
        expect(chip).toBeInTheDocument();
    });

    test('has correct aria-label', () => {
        renderWithContext(<MaskedChip/>);
        const chip = screen.getByRole('img');
        expect(chip).toHaveAttribute('aria-label', 'Hidden values that you do not have permission to view');
    });

    test('does not have aria-readonly (invalid for role="img")', () => {
        renderWithContext(<MaskedChip/>);
        const chip = screen.getByRole('img');
        expect(chip).not.toHaveAttribute('aria-readonly');
    });

    test('does not render a close/remove button', () => {
        renderWithContext(<MaskedChip/>);
        const removeButtons = document.querySelectorAll('.select__multi-value__remove');
        expect(removeButtons).toHaveLength(0);
    });

    test('has the masked CSS class', () => {
        renderWithContext(<MaskedChip/>);
        const chip = screen.getByRole('img');
        expect(chip).toHaveClass('select__multi-value--masked');
    });
});

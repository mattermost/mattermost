// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AttributeChip from './attribute_chip';

describe('AttributeChip', () => {
    test('renders the value as text, so colour is never the only carrier of meaning', () => {
        renderWithContext(
            <AttributeChip
                label='Program'
                value='AURORA'
                color='#1e325c'
            />,
        );

        expect(screen.getByText('AURORA')).toBeInTheDocument();
    });

    test('includes the attribute label in the accessible name', () => {
        renderWithContext(
            <AttributeChip
                label='Program'
                value='AURORA'
            />,
        );

        // A chip announcing only "AURORA" says nothing about what it describes.
        expect(screen.getByTestId('attributeChip')).toHaveTextContent('Program: AURORA');
    });

    test('omits the announced label when one is already visible beside the chip', () => {
        renderWithContext(
            <AttributeChip
                label='Program'
                value='AURORA'
                announceLabel={false}
            />,
        );

        expect(screen.getByTestId('attributeChip')).toHaveTextContent('AURORA');
        expect(screen.getByTestId('attributeChip')).not.toHaveTextContent('Program:');
    });

    test('derives a contrasting foreground from the configured background', () => {
        const {rerender} = renderWithContext(
            <AttributeChip
                label='Classification'
                value='DARK'
                color='#000000'
            />,
        );
        expect(screen.getByTestId('attributeChip')).toHaveStyle({backgroundColor: '#000000', color: '#ffffff'});

        rerender(
            <AttributeChip
                label='Classification'
                value='LIGHT'
                color='#ffffff'
            />,
        );
        expect(screen.getByTestId('attributeChip')).toHaveStyle({backgroundColor: '#ffffff', color: '#000000'});
    });

    test('falls back to the neutral treatment without a colour', () => {
        renderWithContext(
            <AttributeChip
                label='Caveat'
                value='NOFORN'
            />,
        );

        expect(screen.getByTestId('attributeChip')).toHaveClass('AttributeChip--neutral');
    });

    test('falls back to the neutral treatment for a malformed colour', () => {
        // Unknown text on unknown background is worse than a plain chip.
        renderWithContext(
            <AttributeChip
                label='Caveat'
                value='NOFORN'
                color='not-a-hex'
            />,
        );

        expect(screen.getByTestId('attributeChip')).toHaveClass('AttributeChip--neutral');
    });
});

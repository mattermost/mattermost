// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AttributeChip, {AttributeChipRemoveButton} from './attribute_chip';

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

    test('falls back to the neutral treatment for a six-character non-hex colour', () => {
        // Six characters passes a length-only check, but 'zzzzzz' has no hex
        // digits -- it must not slip past validation into an unreadable chip.
        renderWithContext(
            <AttributeChip
                label='Caveat'
                value='NOFORN'
                color='zzzzzz'
            />,
        );

        const chip = screen.getByTestId('attributeChip');
        expect(chip).toHaveClass('AttributeChip--neutral');
        expect(chip).not.toHaveStyle({color: '#ffffff'});
    });

    test('renders a circular remove control inside the chip when provided as children', async () => {
        const onRemove = jest.fn();
        renderWithContext(
            <AttributeChip
                label='Severity'
                value='SEV 1'
            >
                <AttributeChipRemoveButton
                    onRemove={onRemove}
                    removeLabel='Clear Severity'
                />
            </AttributeChip>,
        );

        const chip = screen.getByTestId('attributeChip');
        const remove = screen.getByRole('button', {name: 'Clear Severity'});
        expect(chip).toContainElement(remove);
        expect(chip).toHaveClass('AttributeChip--dismissible');

        await userEvent.click(remove);
        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    test('keeps medium box size whether or not the chip is dismissible', () => {
        const {rerender} = renderWithContext(
            <AttributeChip
                label='Classification'
                value='TOP SECRET'
                color='#8B0000'
                size='medium'
            />,
        );

        expect(screen.getByTestId('attributeChip')).toHaveClass('AttributeChip--medium');
        expect(screen.getByTestId('attributeChip')).not.toHaveClass('AttributeChip--dismissible');

        rerender(
            <AttributeChip
                label='Classification'
                value='TOP SECRET'
                color='#8B0000'
                size='medium'
            >
                <AttributeChipRemoveButton
                    onRemove={jest.fn()}
                    removeLabel='Clear Classification'
                />
            </AttributeChip>,
        );

        expect(screen.getByTestId('attributeChip')).toHaveClass('AttributeChip--medium');
        expect(screen.getByTestId('attributeChip')).toHaveClass('AttributeChip--dismissible');
    });

    test('truncates long values on the value span so the remove control stays visible', () => {
        const longValue = 'Potato What to eatWhat to eatWhat to eatWhat to eat';
        renderWithContext(
            <AttributeChip
                label='What to eat'
                value={longValue}
                size='medium'
            >
                <AttributeChipRemoveButton
                    onRemove={jest.fn()}
                    removeLabel='Remove Potato'
                />
            </AttributeChip>,
        );

        const chip = screen.getByTestId('attributeChip');
        const value = chip.querySelector('.AttributeChip__value');
        expect(value).toHaveTextContent(longValue);
        expect(chip).toContainElement(screen.getByRole('button', {name: 'Remove Potato'}));
    });

    test('keeps the remove control in sequential keyboard order', async () => {
        const onRemove = jest.fn();
        renderWithContext(
            <AttributeChipRemoveButton
                onRemove={onRemove}
                removeLabel='Clear Severity'
            />,
        );

        await userEvent.tab();
        expect(screen.getByRole('button', {name: 'Clear Severity'})).toHaveFocus();

        await userEvent.keyboard('{Enter}');
        expect(onRemove).toHaveBeenCalledTimes(1);
    });
});

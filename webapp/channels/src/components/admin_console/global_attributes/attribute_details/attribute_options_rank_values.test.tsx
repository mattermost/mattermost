// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AttributeOptionsRankValues from './attribute_options_rank_values';

describe('AttributeOptionsRankValues', () => {
    const baseOptions = (): PropertyFieldOption[] => [
        {id: 'a', name: 'Low', rank: 1},
        {id: 'b', name: 'High', rank: 2},
    ];

    it('renders a numbered chip per option in ascending rank order', () => {
        renderWithContext(
            <AttributeOptionsRankValues
                options={baseOptions()}
                onOptionsChange={jest.fn()}
            />,
        );

        const chips = screen.getAllByTestId('attributeOptionsRankValues__chipLabel');
        expect(chips.map((chip) => chip.textContent)).toEqual(['Low', 'High']);
        expect(screen.getAllByTestId('rank-badge').map((badge) => badge.textContent)).toEqual(['1', '2']);
    });

    it('adds a new option via Enter with the next rank', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsRankValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsRankValues__addInput'), 'Highest{Enter}');

        expect(onOptionsChange).toHaveBeenCalledWith([...baseOptions(), {id: '', name: 'Highest', rank: 3}]);
    });

    it('does not add a duplicate name, and shows an inline uniqueness error', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsRankValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsRankValues__addInput'), 'Low{Enter}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();
    });

    it('removes an option via its remove button', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsRankValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getAllByRole('button', {name: 'Remove option'})[0]);

        // The first chip (rank 1, "Low") is removed; the remaining chip's own
        // rank is left untouched (a gap is fine -- see plan Acceptance Criteria).
        expect(onOptionsChange).toHaveBeenCalledWith([{id: 'b', name: 'High', rank: 2}]);
    });

    it('renaming an option to another option\'s name is blocked with an inline error', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsRankValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getByTestId('attribute-rank-chip-1'));
        const input = screen.getByRole('textbox', {name: 'Option label'});
        await userEvent.clear(input);
        await userEvent.type(input, 'Low{Enter}');

        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('renames an option to a unique name and keeps its rank', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsRankValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getByTestId('attribute-rank-chip-1'));
        const input = screen.getByRole('textbox', {name: 'Option label'});
        await userEvent.clear(input);
        await userEvent.type(input, 'Highest{Enter}');

        expect(onOptionsChange).toHaveBeenCalledWith([
            {id: 'a', name: 'Low', rank: 1},
            {id: 'b', name: 'Highest', rank: 2},
        ]);
    });

    it('shows each chip\'s own "(Lowest)"/"(Highest)" boundary label next to its Rank submenu trigger', async () => {
        renderWithContext(
            <AttributeOptionsRankValues
                options={baseOptions()}
                onOptionsChange={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByTestId('attribute-rank-chip-0'));
        expect(screen.getByText('1 (Lowest)')).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');

        await userEvent.click(screen.getByTestId('attribute-rank-chip-1'));
        expect(screen.getByText('2 (Highest)')).toBeInTheDocument();
    });

    it('moves an option to a different rank position via the Rank submenu, redistributing existing rank values', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsRankValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getByTestId('attribute-rank-chip-1'));
        await userEvent.click(screen.getByText('Rank'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: '1'}));

        expect(onOptionsChange).toHaveBeenCalledWith([
            {id: 'b', name: 'High', rank: 1},
            {id: 'a', name: 'Low', rank: 2},
        ]);
    });
});

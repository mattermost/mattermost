// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AttributeOptionsValues from './attribute_options_values';

describe('AttributeOptionsValues', () => {
    const baseOptions = (): PropertyFieldOption[] => [
        {id: 'a', name: 'Engineering'},
        {id: 'b', name: 'Sales'},
    ];

    it('adds a new option via Enter', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsValues
                options={[]}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Marketing{Enter}');

        expect(onOptionsChange).toHaveBeenCalledWith([{id: '', name: 'Marketing'}]);
    });

    it('adds a new option via Tab when the pending value is valid', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Marketing');
        await userEvent.tab();

        expect(onOptionsChange).toHaveBeenCalledWith([...baseOptions(), {id: '', name: 'Marketing'}]);
    });

    it('does not add a duplicate name, and shows an inline uniqueness error', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering{Enter}');

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();
    });

    it('Tab moves focus normally (does not commit) when the pending value is a duplicate', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <>
                <AttributeOptionsValues
                    options={baseOptions()}
                    onOptionsChange={onOptionsChange}
                />
                <button>{'after'}</button>
            </>,
        );

        await userEvent.type(screen.getByTestId('attributeOptionsValues__addInput'), 'Engineering');
        await userEvent.tab();

        expect(onOptionsChange).not.toHaveBeenCalled();
        expect(screen.getByText('after')).toHaveFocus();
    });

    it('removes an option via its remove button', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getAllByRole('button', {name: 'Remove option'})[0]);

        expect(onOptionsChange).toHaveBeenCalledWith([{id: 'b', name: 'Sales'}]);
    });

    it('pressing Escape while renaming discards the edit instead of committing it on blur', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getByTestId('attribute-option-chip-1'));
        const input = screen.getByRole('textbox', {name: 'Option label'});
        await userEvent.clear(input);
        await userEvent.type(input, 'Discarded{Escape}');

        // The popover closing blurs the input; the discarded edit must not commit.
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('renaming an option to another option\'s name is blocked with an inline error', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getByTestId('attribute-option-chip-1'));
        const input = screen.getByRole('textbox', {name: 'Option label'});
        await userEvent.clear(input);
        await userEvent.type(input, 'Engineering{Enter}');

        expect(screen.getByText('Values must be unique.')).toBeInTheDocument();
        expect(onOptionsChange).not.toHaveBeenCalled();
    });

    it('renames an option to a unique name', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getByTestId('attribute-option-chip-1'));
        const input = screen.getByRole('textbox', {name: 'Option label'});
        await userEvent.clear(input);
        await userEvent.type(input, 'Marketing{Enter}');

        expect(onOptionsChange).toHaveBeenCalledWith([
            {id: 'a', name: 'Engineering'},
            {id: 'b', name: 'Marketing'},
        ]);
    });

    it('moves an option to a different position via the keyboard-operable "Move to position" submenu', async () => {
        const onOptionsChange = jest.fn();
        renderWithContext(
            <AttributeOptionsValues
                options={baseOptions()}
                onOptionsChange={onOptionsChange}
            />,
        );

        await userEvent.click(screen.getByTestId('attribute-option-chip-1'));
        await userEvent.click(screen.getByText('Move to position'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: '1'}));

        expect(onOptionsChange).toHaveBeenCalledWith([
            {id: 'b', name: 'Sales'},
            {id: 'a', name: 'Engineering'},
        ]);
    });
});

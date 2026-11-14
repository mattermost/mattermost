// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

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

    it('lists the options without any control to change them when read-only', () => {
        renderWithContext(
            <AttributeOptionsValues
                options={baseOptions()}
                onOptionsChange={jest.fn()}
                readOnly={true}
            />,
        );

        const list = screen.getByRole('list', {name: 'Options'});
        expect(list).toHaveTextContent('EngineeringSales');
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.queryByTestId('attributeOptionsValues__addInput')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders nothing to list when read-only with no options yet', () => {
        renderWithContext(
            <AttributeOptionsValues
                options={[]}
                onOptionsChange={jest.fn()}
                readOnly={true}
            />,
        );

        expect(screen.getByTestId('attributeOptionsValues')).toBeEmptyDOMElement();
    });
    describe('removing an option channels may use', () => {
        const usageCheck = {objectType: 'template', fieldId: 'field-1'};

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('keeps the option and shows the error when channels use it', async () => {
            const inUse = jest.spyOn(Client4, 'getPropertyFieldOptionsInUse').mockResolvedValue({option_ids: ['a']});
            const onOptionsChange = jest.fn();
            renderWithContext(
                <AttributeOptionsValues
                    options={baseOptions()}
                    onOptionsChange={onOptionsChange}
                    usageCheck={usageCheck}
                />,
            );

            await userEvent.click(screen.getAllByRole('button', {name: 'Remove option'})[0]);

            const error = await screen.findByTestId('optionInUseError-a');
            expect(error).toHaveAttribute('role', 'alert');
            expect(error).toHaveTextContent("This option is applied to channels and can't be deleted.");
            expect(inUse).toHaveBeenCalledWith('access_control', 'template', 'field-1', ['a']);
            expect(onOptionsChange).not.toHaveBeenCalled();
        });

        it('removes the option once the check finds it unused, disabling its remove button meanwhile', async () => {
            let resolveCheck: (value: {option_ids: string[]}) => void = () => {};
            jest.spyOn(Client4, 'getPropertyFieldOptionsInUse').mockReturnValue(new Promise((resolve) => {
                resolveCheck = resolve;
            }));
            const onOptionsChange = jest.fn();
            renderWithContext(
                <AttributeOptionsValues
                    options={baseOptions()}
                    onOptionsChange={onOptionsChange}
                    usageCheck={usageCheck}
                />,
            );

            const [removeFirst] = screen.getAllByRole('button', {name: 'Remove option'});
            await userEvent.click(removeFirst);
            expect(removeFirst).toBeDisabled();
            expect(onOptionsChange).not.toHaveBeenCalled();

            await act(async () => {
                resolveCheck({option_ids: []});
            });

            expect(onOptionsChange).toHaveBeenCalledTimes(1);
            expect(onOptionsChange.mock.calls[0][0].map((option: PropertyFieldOption) => option.id)).toEqual(['b']);
            expect(screen.queryByTestId('optionInUseError-a')).not.toBeInTheDocument();
        });

        it('keeps the option and says so when the check itself fails', async () => {
            jest.spyOn(Client4, 'getPropertyFieldOptionsInUse').mockRejectedValue(new Error('nope'));
            const onOptionsChange = jest.fn();
            renderWithContext(
                <AttributeOptionsValues
                    options={baseOptions()}
                    onOptionsChange={onOptionsChange}
                    usageCheck={usageCheck}
                />,
            );

            await userEvent.click(screen.getAllByRole('button', {name: 'Remove option'})[0]);

            expect(await screen.findByTestId('optionRemoveCheckError-a')).toBeInTheDocument();
            expect(onOptionsChange).not.toHaveBeenCalled();
        });

        it('does not check an option that was never saved', async () => {
            const inUse = jest.spyOn(Client4, 'getPropertyFieldOptionsInUse');
            const onOptionsChange = jest.fn();
            renderWithContext(
                <AttributeOptionsValues
                    options={[{id: '', name: 'Draft'}]}
                    onOptionsChange={onOptionsChange}
                    usageCheck={usageCheck}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Remove option'}));

            expect(inUse).not.toHaveBeenCalled();
            expect(onOptionsChange).toHaveBeenCalledWith([]);
        });

        it('does not check anything without a usage check', async () => {
            const inUse = jest.spyOn(Client4, 'getPropertyFieldOptionsInUse');
            const onOptionsChange = jest.fn();
            renderWithContext(
                <AttributeOptionsValues
                    options={baseOptions()}
                    onOptionsChange={onOptionsChange}
                />,
            );

            await userEvent.click(screen.getAllByRole('button', {name: 'Remove option'})[0]);

            expect(inUse).not.toHaveBeenCalled();
            expect(onOptionsChange).toHaveBeenCalledTimes(1);
        });
    });
});

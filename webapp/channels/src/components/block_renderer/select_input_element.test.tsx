// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import {MmBlocksHandlersContext, MmBlocksInteractionsDisabledContext} from './context';
import {MmBlocksForm} from './form';
import {SelectInputElement} from './select_input_element';

jest.mock('react-select/async', () => ({
    __esModule: true,
    default: ({inputId, value, onChange, loadOptions, onMenuOpen}: {
        inputId?: string;
        value: {label: string; value: string} | Array<{label: string; value: string}> | null;
        onChange: (selected: {label: string; value: string} | null) => void;
        loadOptions: (input: string) => Promise<Array<{label: string; value: string}>>;
        onMenuOpen?: () => void;
    }) => {
        const selected = Array.isArray(value) ? value[0] : value;
        return (
            <div>
                <span data-testid={`${inputId}-selected-label`}>{selected?.label ?? ''}</span>
                <button
                    type='button'
                    data-testid={`${inputId}-open-menu`}
                    onClick={() => onMenuOpen?.()}
                >
                    {'open-menu'}
                </button>
                <button
                    type='button'
                    data-testid={`${inputId}-select-alpha`}
                    onClick={async () => {
                        const options = await loadOptions('');
                        onChange(options.find((o) => o.value === 'a') ?? options[0] ?? null);
                    }}
                >
                    {'select-alpha'}
                </button>
            </div>
        );
    },
}));

describe('SelectInputElement', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    function renderSelect(element: React.ComponentProps<typeof SelectInputElement>['element'], interactionsDisabled = false) {
        return renderWithContext(
            <MmBlocksHandlersContext.Provider value={{onAction}}>
                <MmBlocksForm
                    errors={{}}
                    onErrorsChange={jest.fn()}
                >
                    <MmBlocksInteractionsDisabledContext.Provider value={interactionsDisabled}>
                        <SelectInputElement
                            element={element}
                            postId='post-1'
                        />
                    </MmBlocksInteractionsDisabledContext.Provider>
                </MmBlocksForm>
            </MmBlocksHandlersContext.Provider>,
        );
    }

    it('returns null when name or options are missing', () => {
        const {container: missingName} = renderSelect({
            type: 'select',
            name: '',
            label: 'Color',
            options: [{text: 'Red', value: 'red'}],
        });
        expect(missingName.querySelector('.mm-blocks-select-input')).toBeNull();

        const {container: missingOptions} = renderSelect({
            type: 'select',
            name: 'color',
            label: 'Color',
        });
        expect(missingOptions.querySelector('.mm-blocks-select-input')).toBeNull();
    });

    it('renders without a label when label is empty', () => {
        renderSelect({
            type: 'select',
            name: 'color',
            label: '',
            style: 'expanded',
            options: [{text: 'Red', value: 'red'}],
        });

        expect(screen.queryByTestId('mm-blocks-post-1-colorlabel')).not.toBeInTheDocument();
        expect(screen.queryByText('*')).not.toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Red'})).toBeInTheDocument();
    });

    it('renders compact AutocompleteSelector for flat single-select options', () => {
        renderSelect({
            type: 'select',
            name: 'color',
            label: 'Color',
            placeholder: 'Pick a color',
            initial_option: 'green',
            options: [
                {text: 'Red', value: 'red'},
                {text: 'Green', value: 'green'},
            ],
        });

        expect(screen.getByTestId('mm-blocks-post-1-colorlabel')).toHaveTextContent('Color *');
        expect(screen.getByPlaceholderText('Pick a color')).toHaveValue('Green');
    });

    it('renders expanded RadioSetting for single-select', () => {
        renderSelect({
            type: 'select',
            name: 'color',
            label: 'Color',
            style: 'expanded',
            initial_option: 'red',
            options: [
                {text: 'Red', value: 'red'},
                {text: 'Blue', value: 'blue'},
            ],
        });

        expect(screen.getByRole('radio', {name: 'Red'})).toBeChecked();
        expect(screen.getByRole('radio', {name: 'Blue'})).not.toBeChecked();
    });

    it('updates form value from expanded radio and fires onChange', async () => {
        const user = userEvent.setup();
        renderSelect({
            type: 'select',
            name: 'color',
            label: 'Color',
            style: 'expanded',
            onChange: 'refresh_form',
            options: [
                {text: 'Red', value: 'red'},
                {text: 'Blue', value: 'blue'},
            ],
        });

        await user.click(screen.getByRole('radio', {name: 'Blue'}));

        expect(screen.getByRole('radio', {name: 'Blue'})).toBeChecked();
        expect(onAction).toHaveBeenLastCalledWith(
            'refresh_form',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({color: 'blue'}),
        );
    });

    it('renders expanded checkboxes for multiselect', async () => {
        const user = userEvent.setup();
        renderSelect({
            type: 'select',
            name: 'colors',
            label: 'Colors',
            style: 'expanded',
            multiselect: true,
            initial_options: ['red'],
            options: [
                {text: 'Red', value: 'red'},
                {text: 'Blue', value: 'blue'},
            ],
        });

        expect(screen.getByRole('checkbox', {name: 'Red'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Blue'})).not.toBeChecked();

        await user.click(screen.getByRole('checkbox', {name: 'Blue'}));
        expect(screen.getByRole('checkbox', {name: 'Blue'})).toBeChecked();
    });

    it('renders option groups in expanded mode', () => {
        renderSelect({
            type: 'select',
            name: 'fruit',
            label: 'Fruit',
            style: 'expanded',
            option_groups: [
                {
                    label: 'Citrus',
                    options: [
                        {text: 'Orange', value: 'orange'},
                        {text: 'Lemon', value: 'lemon'},
                    ],
                },
                {
                    label: 'Berries',
                    options: [{text: 'Strawberry', value: 'strawberry'}],
                },
            ],
        });

        expect(screen.getByText('Citrus')).toBeInTheDocument();
        expect(screen.getByText('Berries')).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Orange'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Strawberry'})).toBeInTheDocument();
    });

    it('disables controls when interactions are disabled', () => {
        renderSelect({
            type: 'select',
            name: 'color',
            label: 'Color',
            style: 'expanded',
            options: [{text: 'Red', value: 'red'}],
        }, true);

        expect(screen.getByRole('radio', {name: 'Red'})).toBeDisabled();
    });

    it('shows lookup option label after selection, not the value', async () => {
        const user = userEvent.setup();
        const onLookup = jest.fn().mockResolvedValue([
            {text: 'Alpha', value: 'a'},
            {text: 'Beta', value: 'b'},
        ]);

        renderWithContext(
            <MmBlocksHandlersContext.Provider value={{onAction, onLookup}}>
                <MmBlocksForm
                    errors={{}}
                    onErrorsChange={jest.fn()}
                >
                    <SelectInputElement
                        element={{
                            type: 'select',
                            name: 'pick',
                            label: 'Dynamic option',
                            data_source: 'dynamic',
                            data_source_action: 'dialog_lookup',
                        }}
                        postId='post-1'
                    />
                </MmBlocksForm>
            </MmBlocksHandlersContext.Provider>,
        );

        await user.click(screen.getByTestId('mm-blocks-post-1-pick-select-alpha'));

        expect(screen.getByTestId('mm-blocks-post-1-pick-selected-label')).toHaveTextContent('Alpha');
        expect(screen.getByTestId('mm-blocks-post-1-pick-selected-label')).not.toHaveTextContent(/^a$/);
    });

    it('defers lookup until the select menu opens', async () => {
        const user = userEvent.setup();
        const onLookup = jest.fn().mockResolvedValue([
            {text: 'Alpha', value: 'a'},
            {text: 'Beta', value: 'b'},
        ]);

        renderWithContext(
            <MmBlocksHandlersContext.Provider value={{onAction, onLookup}}>
                <MmBlocksForm
                    errors={{}}
                    onErrorsChange={jest.fn()}
                >
                    <SelectInputElement
                        element={{
                            type: 'select',
                            name: 'pick',
                            label: 'Dynamic option',
                            data_source: 'dynamic',
                            data_source_action: 'dialog_lookup',
                        }}
                        postId='post-1'
                    />
                </MmBlocksForm>
            </MmBlocksHandlersContext.Provider>,
        );

        expect(onLookup).not.toHaveBeenCalled();

        await user.click(screen.getByTestId('mm-blocks-post-1-pick-open-menu'));

        await waitFor(() => {
            expect(onLookup).toHaveBeenCalledTimes(1);
        });
        expect(onLookup).toHaveBeenCalledWith('dialog_lookup', '', expect.any(Object));

        await user.click(screen.getByTestId('mm-blocks-post-1-pick-open-menu'));

        expect(onLookup).toHaveBeenCalledTimes(1);
    });
});

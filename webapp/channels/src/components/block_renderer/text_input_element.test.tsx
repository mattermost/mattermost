// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {MmBlocksHandlersContext, MmBlocksInteractionsDisabledContext} from './context';
import {MmBlocksForm} from './form';
import {TextInputElement} from './text_input_element';

describe('TextInputElement', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    function renderInput(element: React.ComponentProps<typeof TextInputElement>['element'], interactionsDisabled = false) {
        return renderWithContext(
            <MmBlocksHandlersContext.Provider value={{onAction}}>
                <MmBlocksForm
                    errors={{}}
                    onErrorsChange={jest.fn()}
                >
                    <MmBlocksInteractionsDisabledContext.Provider value={interactionsDisabled}>
                        <TextInputElement
                            element={element}
                            postId='post-1'
                        />
                    </MmBlocksInteractionsDisabledContext.Provider>
                </MmBlocksForm>
            </MmBlocksHandlersContext.Provider>,
        );
    }

    it('returns null when name is missing', () => {
        const {container: missingName} = renderInput({
            type: 'text_input',
            name: '',
            label: 'Title',
        });
        expect(missingName.querySelector('.mm-blocks-text-input')).toBeNull();
    });

    it('renders without a label when label is empty', () => {
        renderInput({
            type: 'text_input',
            name: 'title',
            label: '',
        });

        expect(screen.queryByTestId('mm-blocks-post-1-titlelabel')).not.toBeInTheDocument();
        expect(screen.getByTestId('mm-blocks-post-1-titleinput')).toBeInTheDocument();
        expect(screen.queryByText('*')).not.toBeInTheDocument();
        expect(screen.queryByText('(optional)')).not.toBeInTheDocument();
    });

    it('renders TextSetting with label, placeholder, and initial value', () => {
        renderInput({
            type: 'text_input',
            name: 'title',
            label: 'Title',
            placeholder: 'Enter title',
            initial_value: 'hello',
            help_text: 'Helpful',
        });

        expect(screen.getByTestId('mm-blocks-post-1-titlelabel')).toHaveTextContent('Title *');
        expect(screen.getByTestId('mm-blocks-post-1-titleinput')).toHaveValue('hello');
        expect(screen.getByTestId('mm-blocks-post-1-titleinput')).toHaveAttribute('placeholder', 'Enter title');
        expect(screen.getByTestId('mm-blocks-post-1-titlehelp-text')).toHaveTextContent('Helpful');
    });

    it('marks optional fields without required asterisk', () => {
        renderInput({
            type: 'text_input',
            name: 'notes',
            label: 'Notes',
            optional: true,
        });

        expect(screen.getByTestId('mm-blocks-post-1-noteslabel')).toHaveTextContent('Notes (optional)');
        expect(screen.getByTestId('mm-blocks-post-1-noteslabel')).not.toHaveTextContent('*');
    });

    it('renders multiline as textarea', () => {
        renderInput({
            type: 'text_input',
            name: 'body',
            label: 'Body',
            multiline: true,
        });

        expect(screen.getByTestId('mm-blocks-post-1-bodyinput').tagName).toBe('TEXTAREA');
    });

    it('updates form value on change', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'text_input',
            name: 'title',
            label: 'Title',
        });

        const input = screen.getByTestId('mm-blocks-post-1-titleinput');
        await user.clear(input);
        await user.type(input, 'typed');

        expect(input).toHaveValue('typed');
        expect(onAction).not.toHaveBeenCalled();
    });

    it('dispatches onChange action with form values separately from query', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'text_input',
            name: 'title',
            label: 'Title',
            onChange: 'refresh_form',
        });

        const input = screen.getByTestId('mm-blocks-post-1-titleinput');
        await user.clear(input);
        await user.type(input, 'a');

        expect(onAction).toHaveBeenCalled();
        expect(onAction).toHaveBeenLastCalledWith('refresh_form', undefined, undefined, undefined, expect.objectContaining({title: 'a'}));
    });

    it('disables input when interactions are disabled', () => {
        renderInput({
            type: 'text_input',
            name: 'title',
            label: 'Title',
        }, true);

        expect(screen.getByTestId('mm-blocks-post-1-titleinput')).toBeDisabled();
    });

    it('stores number subtype values as numbers and treats zero as filled', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'text_input',
            name: 'amount',
            label: 'Amount',
            subtype: 'number',
            onChange: 'refresh_form',
            initial_value: '0',
        });

        const input = screen.getByTestId('mm-blocks-post-1-amountinput');
        expect(input).toHaveValue('0');

        await user.clear(input);
        await user.type(input, '42');

        expect(input).toHaveValue('42');
        expect(onAction).toHaveBeenLastCalledWith(
            'refresh_form',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({amount: 42}),
        );
    });

    it('preserves intermediate number text while editing', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'text_input',
            name: 'amount',
            label: 'Amount',
            subtype: 'number',
            onChange: 'refresh_form',
        });

        const input = screen.getByTestId('mm-blocks-post-1-amountinput');
        await user.clear(input);
        await user.type(input, '-');
        expect(input).toHaveValue('-');
        expect(onAction).toHaveBeenLastCalledWith(
            'refresh_form',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({amount: '-'}),
        );

        await user.type(input, '5');
        expect(input).toHaveValue('-5');
        expect(onAction).toHaveBeenLastCalledWith(
            'refresh_form',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({amount: -5}),
        );
    });
});

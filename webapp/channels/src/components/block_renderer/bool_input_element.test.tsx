// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {BoolInputElement} from './bool_input_element';
import {MmBlocksHandlersContext, MmBlocksInteractionsDisabledContext} from './context';
import {MmBlocksForm} from './form';

describe('BoolInputElement', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    function renderInput(element: React.ComponentProps<typeof BoolInputElement>['element'], interactionsDisabled = false) {
        return renderWithContext(
            <MmBlocksHandlersContext.Provider value={{onAction}}>
                <MmBlocksForm
                    errors={{}}
                    onErrorsChange={jest.fn()}
                >
                    <MmBlocksInteractionsDisabledContext.Provider value={interactionsDisabled}>
                        <BoolInputElement
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
            type: 'bool_input',
            name: '',
            label: 'Notify',
        });
        expect(missingName.querySelector('.mm-blocks-bool-input')).toBeNull();
    });

    it('renders without a label when label is empty', () => {
        renderInput({
            type: 'bool_input',
            name: 'notify',
            label: '',
        });

        expect(screen.queryByTestId('mm-blocks-post-1-notifylabel')).not.toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
        expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('renders BoolSetting with label, placeholder, and initial value', () => {
        renderInput({
            type: 'bool_input',
            name: 'notify',
            label: 'Notifications',
            placeholder: 'Send email updates',
            initial_value: true,
            help_text: 'Helpful',
        });

        expect(screen.getByTestId('mm-blocks-post-1-notifylabel')).toHaveTextContent('Notifications *');
        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(screen.getByText('Send email updates')).toBeInTheDocument();
        expect(screen.getByTestId('mm-blocks-post-1-notifyhelp-text')).toHaveTextContent('Helpful');
    });

    it('marks optional fields without required asterisk', () => {
        renderInput({
            type: 'bool_input',
            name: 'notify',
            label: 'Notifications',
            optional: true,
        });

        expect(screen.getByTestId('mm-blocks-post-1-notifylabel')).toHaveTextContent('Notifications (optional)');
        expect(screen.getByTestId('mm-blocks-post-1-notifylabel')).not.toHaveTextContent('*');
    });

    it('defaults unchecked when initial_value is omitted', () => {
        renderInput({
            type: 'bool_input',
            name: 'notify',
            label: 'Notifications',
        });

        expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('updates form value on change', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'bool_input',
            name: 'notify',
            label: 'Notifications',
        });

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();

        await user.click(checkbox);

        expect(checkbox).toBeChecked();
        expect(onAction).not.toHaveBeenCalled();
    });

    it('dispatches onChange action with form values separately from query', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'bool_input',
            name: 'notify',
            label: 'Notifications',
            onChange: 'refresh_form',
        });

        await user.click(screen.getByRole('checkbox'));

        expect(onAction).toHaveBeenCalled();
        expect(onAction).toHaveBeenLastCalledWith(
            'refresh_form',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({notify: true}),
        );
    });

    it('disables input when interactions are disabled', () => {
        renderInput({
            type: 'bool_input',
            name: 'notify',
            label: 'Notifications',
        }, true);

        expect(screen.getByRole('checkbox')).toBeDisabled();
    });
});

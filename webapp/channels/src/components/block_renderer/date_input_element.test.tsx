// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {MmBlocksHandlersContext, MmBlocksInteractionsDisabledContext} from './context';
import {DateInputElement} from './date_input_element';
import {MmBlocksForm} from './form';

jest.mock('components/apps_form/apps_form_date_field', () => ({
    __esModule: true,
    default: ({field, value, onChange}: {
        field: {name: string; hint?: string; readonly?: boolean};
        value: string | null;
        onChange: (name: string, value: string | null) => void;
    }) => (
        <button
            type='button'
            data-testid={`${field.name}-date`}
            disabled={field.readonly === true}
            onClick={() => onChange(field.name, '2025-06-15')}
        >
            {value || field.hint || 'empty'}
        </button>
    ),
}));

describe('DateInputElement', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    function renderInput(
        element: React.ComponentProps<typeof DateInputElement>['element'],
        interactionsDisabled = false,
        errors?: Record<string, string>,
    ) {
        return renderWithContext(
            <MmBlocksHandlersContext.Provider value={{onAction}}>
                <MmBlocksForm
                    errors={errors ?? {}}
                    onErrorsChange={jest.fn()}
                >
                    <MmBlocksInteractionsDisabledContext.Provider value={interactionsDisabled}>
                        <DateInputElement
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
            type: 'date_input',
            name: '',
            label: 'Due',
        });
        expect(missingName.querySelector('.mm-blocks-date-input')).toBeNull();
    });

    it('renders without a label when label is empty', () => {
        renderInput({
            type: 'date_input',
            name: 'due',
            label: '',
            optional: true,
        });

        expect(screen.queryByText('*')).not.toBeInTheDocument();
        expect(screen.queryByText('(optional)')).not.toBeInTheDocument();
        expect(screen.getByTestId('due-date')).toBeInTheDocument();
    });

    it('renders label, placeholder, and initial value', () => {
        renderInput({
            type: 'date_input',
            name: 'due',
            label: 'Due date',
            placeholder: 'Pick a date',
            initial_value: '2025-01-10',
            help_text: 'Helpful',
        });

        expect(screen.getByText('Due date')).toBeInTheDocument();
        expect(screen.getByText('*')).toBeInTheDocument();
        expect(screen.getByTestId('due-date')).toHaveTextContent('2025-01-10');
        expect(screen.getByText('Helpful')).toBeInTheDocument();
    });

    it('renders placeholder when no initial value', () => {
        renderInput({
            type: 'date_input',
            name: 'due',
            label: 'Due date',
            placeholder: 'Pick a date',
        });

        expect(screen.getByText('Pick a date')).toBeInTheDocument();
    });

    it('marks optional fields without required asterisk', () => {
        renderInput({
            type: 'date_input',
            name: 'due',
            label: 'Due date',
            optional: true,
        });

        expect(screen.getByText('(optional)')).toBeInTheDocument();
        expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('updates form value on change', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'date_input',
            name: 'due',
            label: 'Due date',
        });

        await user.click(screen.getByTestId('due-date'));

        expect(screen.getByTestId('due-date')).toHaveTextContent('2025-06-15');
        expect(onAction).not.toHaveBeenCalled();
    });

    it('dispatches onChange action with form values', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'date_input',
            name: 'due',
            label: 'Due date',
            onChange: 'refresh_form',
        });

        await user.click(screen.getByTestId('due-date'));

        expect(onAction).toHaveBeenLastCalledWith(
            'refresh_form',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({due: '2025-06-15'}),
        );
    });

    it('shows field error', () => {
        renderInput({
            type: 'date_input',
            name: 'due',
            label: 'Due date',
        }, false, {due: 'Required'});

        expect(screen.getByTestId('due-error')).toHaveTextContent('Required');
    });

    it('disables input when interactions are disabled', () => {
        renderInput({
            type: 'date_input',
            name: 'due',
            label: 'Due date',
        }, true);

        expect(screen.getByTestId('due-date')).toBeDisabled();
    });
});

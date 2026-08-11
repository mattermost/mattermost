// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {MmBlocksHandlersContext, MmBlocksInteractionsDisabledContext} from './context';
import {DateTimeInputElement} from './datetime_input_element';
import {MmBlocksForm} from './form';

jest.mock('components/apps_form/apps_form_datetime_field', () => ({
    __esModule: true,
    default: ({field, value, onChange}: {
        field: {name: string; readonly?: boolean};
        value: string | null;
        onChange: (name: string, value: string | null) => void;
    }) => (
        <button
            type='button'
            data-testid={`${field.name}-datetime`}
            disabled={field.readonly === true}
            onClick={() => onChange(field.name, '2025-06-15T10:00:00Z')}
        >
            {value || 'empty'}
        </button>
    ),
}));

describe('DateTimeInputElement', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    function renderInput(
        element: React.ComponentProps<typeof DateTimeInputElement>['element'],
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
                        <DateTimeInputElement
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
            type: 'datetime_input',
            name: '',
            label: 'Meeting',
        });
        expect(missingName.querySelector('.mm-blocks-datetime-input')).toBeNull();
    });

    it('renders without a label when label is empty', () => {
        renderInput({
            type: 'datetime_input',
            name: 'meeting',
            label: '',
        });

        expect(screen.queryByText('*')).not.toBeInTheDocument();
        expect(screen.getByTestId('meeting-datetime')).toBeInTheDocument();
    });

    it('renders label and initial value', () => {
        renderInput({
            type: 'datetime_input',
            name: 'meeting',
            label: 'Meeting time',
            initial_value: '2025-01-10T09:00:00Z',
            help_text: 'Helpful',
        });

        expect(screen.getByText('Meeting time')).toBeInTheDocument();
        expect(screen.getByTestId('meeting-datetime')).toHaveTextContent('2025-01-10T09:00:00Z');
        expect(screen.getByText('Helpful')).toBeInTheDocument();
    });

    it('updates form value on change', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'datetime_input',
            name: 'meeting',
            label: 'Meeting time',
        });

        await user.click(screen.getByTestId('meeting-datetime'));

        expect(screen.getByTestId('meeting-datetime')).toHaveTextContent('2025-06-15T10:00:00Z');
        expect(onAction).not.toHaveBeenCalled();
    });

    it('dispatches onChange action with form values', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'datetime_input',
            name: 'meeting',
            label: 'Meeting time',
            onChange: 'refresh_form',
        });

        await user.click(screen.getByTestId('meeting-datetime'));

        expect(onAction).toHaveBeenLastCalledWith(
            'refresh_form',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({meeting: '2025-06-15T10:00:00Z'}),
        );
    });

    it('shows field error', () => {
        renderInput({
            type: 'datetime_input',
            name: 'meeting',
            label: 'Meeting time',
        }, false, {meeting: 'Required'});

        expect(screen.getByTestId('meeting-error')).toHaveTextContent('Required');
    });

    it('disables input when interactions are disabled', () => {
        renderInput({
            type: 'datetime_input',
            name: 'meeting',
            label: 'Meeting time',
        }, true);

        expect(screen.getByTestId('meeting-datetime')).toBeDisabled();
    });
});

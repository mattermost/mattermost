// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {MmBlocksHandlersContext, MmBlocksInteractionsDisabledContext} from './context';
import {FileInputElement} from './file_input_element';
import {MmBlocksForm} from './form';

jest.mock('components/apps_form/apps_form_file_upload', () => ({
    __esModule: true,
    default: ({id, label, helpText, value, disabled, allowMultiple, onFileSelected}: {
        id: string;
        label: React.ReactNode;
        helpText?: React.ReactNode;
        value?: string[];
        disabled?: boolean;
        allowMultiple?: boolean;
        onFileSelected: (fileIds: string[]) => void;
    }) => (
        <div data-testid={`${id}-file`}>
            {Boolean(label) && <span data-testid={`${id}-label`}>{label}</span>}
            {helpText}
            <span data-testid={`${id}-value`}>{(value ?? []).join(',')}</span>
            <span data-testid={`${id}-multiple`}>{String(allowMultiple === true)}</span>
            <button
                type='button'
                data-testid={`${id}-select`}
                disabled={disabled === true}
                onClick={() => onFileSelected(['file-a', 'file-b'])}
            >
                {'select'}
            </button>
        </div>
    ),
}));

describe('FileInputElement', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    function renderInput(
        element: React.ComponentProps<typeof FileInputElement>['element'],
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
                        <FileInputElement
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
            type: 'file_input',
            name: '',
            label: 'Files',
        });
        expect(missingName.querySelector('.mm-blocks-file-input')).toBeNull();
    });

    it('renders without a label when label is empty', () => {
        renderInput({
            type: 'file_input',
            name: 'attachments',
            label: '',
        });

        expect(screen.queryByTestId('mm-blocks-post-1-attachments-label')).not.toBeInTheDocument();
        expect(screen.queryByText('*')).not.toBeInTheDocument();
        expect(screen.getByTestId('mm-blocks-post-1-attachments-file')).toBeInTheDocument();
    });

    it('hydrates value from initial_value file IDs', () => {
        renderInput({
            type: 'file_input',
            name: 'attachments',
            label: 'Attachments',
            initial_value: 'file-a, file-b',
        });

        expect(screen.getByTestId('mm-blocks-post-1-attachments-value')).toHaveTextContent('file-a,file-b');
    });

    it('renders label and allow_multiple', () => {
        renderInput({
            type: 'file_input',
            name: 'attachments',
            label: 'Attachments',
            allow_multiple: true,
            help_text: 'Helpful',
        });

        expect(screen.getByTestId('mm-blocks-post-1-attachments-label')).toHaveTextContent('Attachments *');
        expect(screen.getByTestId('mm-blocks-post-1-attachments-multiple')).toHaveTextContent('true');
        expect(screen.getByText('Helpful')).toBeInTheDocument();
    });

    it('updates form value on file selection', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'file_input',
            name: 'attachments',
            label: 'Attachments',
        });

        await user.click(screen.getByTestId('mm-blocks-post-1-attachments-select'));

        expect(screen.getByTestId('mm-blocks-post-1-attachments-value')).toHaveTextContent('file-a,file-b');
        expect(onAction).not.toHaveBeenCalled();
    });

    it('dispatches onChange action with comma-joined file ids', async () => {
        const user = userEvent.setup();
        renderInput({
            type: 'file_input',
            name: 'attachments',
            label: 'Attachments',
            onChange: 'refresh_form',
        });

        await user.click(screen.getByTestId('mm-blocks-post-1-attachments-select'));

        expect(onAction).toHaveBeenLastCalledWith(
            'refresh_form',
            undefined,
            undefined,
            undefined,
            expect.objectContaining({attachments: ['file-a', 'file-b']}),
        );
    });

    it('shows field error', () => {
        renderInput({
            type: 'file_input',
            name: 'attachments',
            label: 'Attachments',
        }, false, {attachments: 'Required'});

        expect(screen.getByTestId('attachments-error')).toHaveTextContent('Required');
    });

    it('disables input when interactions are disabled', () => {
        renderInput({
            type: 'file_input',
            name: 'attachments',
            label: 'Attachments',
        }, true);

        expect(screen.getByTestId('mm-blocks-post-1-attachments-select')).toBeDisabled();
    });
});

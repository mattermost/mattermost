// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {ReactNode} from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {MmBlocksForm, useMmBlocksForm} from './form';
import type {MmBlocksFormErrors} from './form';

function FormProbe() {
    const {values, getValue, setValue, setDefaultValue, errors, setErrors, clearError} = useMmBlocksForm();

    return (
        <div>
            <span data-testid='title-value'>{String(getValue('title') ?? '')}</span>
            <span data-testid='values-json'>{JSON.stringify(values)}</span>
            <span data-testid='errors-json'>{JSON.stringify(errors)}</span>
            <button
                type='button'
                onClick={() => setValue('title', 'hello')}
            >
                {'set-title'}
            </button>
            <button
                type='button'
                onClick={() => setValue('done', true)}
            >
                {'set-done'}
            </button>
            <button
                type='button'
                onClick={() => setDefaultValue('title', 'default')}
            >
                {'set-default-title'}
            </button>
            <button
                type='button'
                onClick={() => setErrors({title: 'Required'})}
            >
                {'set-title-error'}
            </button>
            <button
                type='button'
                onClick={() => setErrors({title: 'Required', body: 'Too short'})}
            >
                {'set-two-errors'}
            </button>
            <button
                type='button'
                onClick={() => {
                    clearError('title');
                    clearError('body');
                }}
            >
                {'clear-both-errors'}
            </button>
        </div>
    );
}

/** Parent-owned errors — same pattern as InteractiveMessages / BlocksDialogShell. */
function ControlledMmBlocksForm({children}: {children: ReactNode}) {
    const [errors, setErrors] = useState<MmBlocksFormErrors>({});
    return (
        <MmBlocksForm
            errors={errors}
            onErrorsChange={setErrors}
        >
            {children}
        </MmBlocksForm>
    );
}

describe('MmBlocksForm', () => {
    it('exposes context so children can set and read field values', async () => {
        renderWithContext(
            <ControlledMmBlocksForm>
                <FormProbe/>
            </ControlledMmBlocksForm>,
        );

        expect(screen.getByTestId('title-value')).toHaveTextContent('');
        expect(screen.getByTestId('values-json')).toHaveTextContent('{}');

        await userEvent.click(screen.getByRole('button', {name: 'set-title'}));
        expect(screen.getByTestId('title-value')).toHaveTextContent('hello');
        expect(screen.getByTestId('values-json')).toHaveTextContent('{"title":"hello"}');

        await userEvent.click(screen.getByRole('button', {name: 'set-done'}));
        expect(screen.getByTestId('values-json')).toHaveTextContent('{"title":"hello","done":true}');
    });

    it('setDefaultValue only seeds missing fields', async () => {
        renderWithContext(
            <ControlledMmBlocksForm>
                <FormProbe/>
            </ControlledMmBlocksForm>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'set-default-title'}));
        expect(screen.getByTestId('title-value')).toHaveTextContent('default');

        await userEvent.click(screen.getByRole('button', {name: 'set-title'}));
        expect(screen.getByTestId('title-value')).toHaveTextContent('hello');

        await userEvent.click(screen.getByRole('button', {name: 'set-default-title'}));
        expect(screen.getByTestId('title-value')).toHaveTextContent('hello');
    });

    it('clears a field error when that field value changes', async () => {
        renderWithContext(
            <ControlledMmBlocksForm>
                <FormProbe/>
            </ControlledMmBlocksForm>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'set-title-error'}));
        expect(screen.getByTestId('errors-json')).toHaveTextContent('{"title":"Required"}');

        await userEvent.click(screen.getByRole('button', {name: 'set-title'}));
        expect(screen.getByTestId('errors-json')).toHaveTextContent('{}');
    });

    it('clears multiple field errors in the same tick without restoring earlier deletions', async () => {
        renderWithContext(
            <ControlledMmBlocksForm>
                <FormProbe/>
            </ControlledMmBlocksForm>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'set-two-errors'}));
        expect(screen.getByTestId('errors-json')).toHaveTextContent('{"title":"Required","body":"Too short"}');

        await userEvent.click(screen.getByRole('button', {name: 'clear-both-errors'}));
        expect(screen.getByTestId('errors-json')).toHaveTextContent('{}');
    });

    it('throws when useMmBlocksForm is used outside MmBlocksForm', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(() => {
            renderWithContext(<FormProbe/>);
        }).toThrow('useMmBlocksForm must be used within MmBlocksForm');

        consoleError.mockRestore();
    });
});

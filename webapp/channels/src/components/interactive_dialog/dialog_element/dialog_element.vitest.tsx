// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import DialogElement from './dialog_element';

describe('components/interactive_dialog/DialogElement', () => {
    const baseDialogProps = {
        displayName: 'Testing',
        name: 'testing',
        type: 'text',
        maxLength: 100,
        actions: {
            autocompleteActiveChannels: vi.fn(),
            autocompleteUsers: vi.fn(),
        },
        onChange: vi.fn(),
    };

    it('type textarea', () => {
        const {container} = renderWithContext(
            <DialogElement
                {...baseDialogProps}
                type='textarea'
            />,
        );

        expect(container.querySelector('textarea')).toBeInTheDocument();
    });

    it('subtype blank', () => {
        renderWithContext(
            <DialogElement
                {...baseDialogProps}
                subtype=''
            />,
        );

        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('type', 'text');
    });

    describe('subtype number', () => {
        test('value is 0', () => {
            renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='text'
                    subtype='number'
                    value={0}
                />,
            );

            const input = screen.getByRole('spinbutton');
            expect(input).toHaveValue(0);
        });

        test('value is 123', () => {
            renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='text'
                    subtype='number'
                    value={123}
                />,
            );

            const input = screen.getByRole('spinbutton');
            expect(input).toHaveValue(123);
        });
    });

    it('subtype email', () => {
        const {container} = renderWithContext(
            <DialogElement
                {...baseDialogProps}
                subtype='email'
            />,
        );

        const input = container.querySelector('input[type="email"]');
        expect(input).toBeInTheDocument();
    });

    it('subtype password', () => {
        const {container} = renderWithContext(
            <DialogElement
                {...baseDialogProps}
                subtype='password'
            />,
        );

        const input = container.querySelector('input[type="password"]');
        expect(input).toBeInTheDocument();
    });

    describe('radioSetting', () => {
        const radioOptions = [
            {value: 'foo', text: 'foo-text'},
            {value: 'bar', text: 'bar-text'},
        ];

        test('RadioSetting is rendered when type is radio', () => {
            renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                />,
            );

            // RadioSetting renders radio inputs, not a radiogroup
            const radios = screen.getAllByRole('radio');
            expect(radios).toHaveLength(2);
        });

        test('RadioSetting is rendered when options are null', () => {
            const {container} = renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                />,
            );

            // When options are empty, RadioSetting still renders but with no radio inputs
            // Check for the setting container element
            expect(container.querySelector('.form-group')).toBeInTheDocument();
        });

        test('RadioSetting is rendered when options are null and value is null', () => {
            const {container} = renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                    value={undefined}
                />,
            );

            // When options are empty, RadioSetting still renders but with no radio inputs
            expect(container.querySelector('.form-group')).toBeInTheDocument();
        });

        test('RadioSetting is rendered when options are null and value is not null', () => {
            const {container} = renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                    value={'a'}
                />,
            );

            // When options are empty, RadioSetting still renders but with no radio inputs
            expect(container.querySelector('.form-group')).toBeInTheDocument();
        });

        test('RadioSetting is rendered when value is not one of the options', () => {
            renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                    value={'a'}
                />,
            );

            // RadioSetting renders radio inputs even when value doesn't match options
            const radios = screen.getAllByRole('radio');
            expect(radios).toHaveLength(2);
        });

        test('No default value is selected from the radio button list', () => {
            renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                />,
            );

            const radios = screen.getAllByRole('radio');
            radios.forEach((radio) => {
                expect(radio).not.toBeChecked();
            });
        });

        test('The default value can be specified from the list', () => {
            renderWithContext(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                    value={radioOptions[1].value}
                />,
            );

            const barRadio = screen.getByLabelText('bar-text');
            expect(barRadio).toBeChecked();
        });
    });
});

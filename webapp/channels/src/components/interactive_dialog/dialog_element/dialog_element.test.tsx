// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import DialogElement from './dialog_element';

describe('components/interactive_dialog/DialogElement', () => {
    const baseDialogProps = {
        displayName: 'Testing',
        name: 'testing',
        type: 'text',
        maxLength: 100,
        actions: {
            autocompleteActiveChannels: jest.fn(),
            autocompleteUsers: jest.fn(),
        },
        onChange: jest.fn(),
    };

    it('type textarea', () => {
        render(
            <DialogElement
                {...baseDialogProps}
                type='textarea'
            />,
        );
        expect(document.querySelector('textarea')).toBeInTheDocument();
    });

    it('subtype blank', () => {
        render(
            <DialogElement
                {...baseDialogProps}
                subtype=''
            />,
        );

        expect(screen.getByTestId('testinginput')).toHaveAttribute('type', 'text');
    });

    describe('subtype number', () => {
        test('value is 0', () => {
            render(
                <DialogElement
                    {...baseDialogProps}
                    type='text'
                    subtype='number'
                    value={0}
                />,
            );
            expect(screen.getByTestId('testingnumber')).toHaveValue(0);
        });

        test('value is 123', () => {
            render(
                <DialogElement
                    {...baseDialogProps}
                    type='text'
                    subtype='number'
                    value={123}
                />,
            );
            expect(screen.getByTestId('testingnumber')).toHaveValue(123);
        });
    });

    it('subtype email', () => {
        render(
            <DialogElement
                {...baseDialogProps}
                subtype='email'
            />,
        );
        expect(screen.getByTestId('testingemail')).toHaveAttribute('type', 'email');
    });

    it('subtype password', () => {
        render(
            <DialogElement
                {...baseDialogProps}
                subtype='password'
            />,
        );
        expect(screen.getByTestId('testingpassword')).toHaveAttribute('type', 'password');
    });

    describe('radioSetting', () => {
        const radioOptions = [
            {value: 'foo', text: 'foo-text'},
            {value: 'bar', text: 'bar-text'},
        ];

        test('RadioSetting is rendered when type is radio', () => {
            render(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                />,
            );

            expect(screen.getAllByRole('radio')).toHaveLength(2);
        });

        test('RadioSetting is rendered when options are null', () => {
            render(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                />,
            );

            expect(screen.getByTestId('testing')).toBeInTheDocument();
        });

        test('RadioSetting is rendered when options are null and value is null', () => {
            render(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                    value={undefined}
                />,
            );

            expect(screen.getByTestId('testing')).toBeInTheDocument();
        });

        test('RadioSetting is rendered when options are null and value is not null', () => {
            render(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                    value={'a'}
                />,
            );

            expect(screen.getByTestId('testing')).toBeInTheDocument();
        });

        test('RadioSetting is rendered when value is not one of the options', () => {
            render(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                    value={'a'}
                />,
            );

            expect(screen.getByTestId('testing')).toBeInTheDocument();
        });

        test('No default value is selected from the radio button list', () => {
            render(
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
            render(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                    value={radioOptions[1].value}
                />,
            );
            expect(screen.getByRole('radio', {name: radioOptions[1].text})).toBeChecked();
        });
    });
});

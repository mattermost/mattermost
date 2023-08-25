// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DialogElement as TDialogElement} from '@mattermost/types/integrations';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import type {Props} from './interactive_dialog';
import InteractiveDialog from './interactive_dialog';

describe('components/interactive_dialog/InteractiveDialog', () => {
    const baseProps: Props = {
        url: 'http://example.com',
        callbackId: 'abc',
        elements: [],
        title: 'test title',
        iconUrl: 'http://example.com/icon.png',
        submitLabel: 'Yes',
        notifyOnCancel: true,
        state: 'some state',
        introductionText: 'Some introduction text',
        onExited: jest.fn(),
        actions: {
            submitInteractiveDialog: jest.fn(),
        },
    };

    describe('generic error message', () => {
        test('should appear when submit returns an error', async () => {
            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {error: 'This is an error.'}}),
                },
            };

            renderWithContext(<InteractiveDialog {...props}/>);

            expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
            expect(screen.queryByText('This is an error.')).not.toBeInTheDocument();

            userEvent.click(screen.getByText('Yes'));

            expect(screen.queryByText('Submitting...')).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.queryByText('This is an error.')).toBeInTheDocument();
            });

            expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
        });

        test('should not appear when submit does not return an error', async () => {
            renderWithContext(<InteractiveDialog {...baseProps}/>);

            expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
            expect(screen.queryByText('This is an error.')).not.toBeInTheDocument();

            userEvent.click(screen.getByText('Yes'));

            expect(screen.queryByText('Submitting...')).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.queryByText('This is an error.')).not.toBeInTheDocument();
            });

            expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
        });
    });

    describe('default select element in Interactive Dialog', () => {
        test('should be enabled by default', () => {
            const selectElement: TDialogElement = {
                data_source: '',
                default: 'opt3',
                display_name: 'Option Selector',
                name: 'someoptionselector',
                optional: false,
                options: [
                    {text: 'Option1', value: 'opt1'},
                    {text: 'Option2', value: 'opt2'},
                    {text: 'Option3', value: 'opt3'},
                ],
                type: 'select',
                subtype: '',
                placeholder: 'test select',
                help_text: '',
                min_length: 0,
                max_length: 0,
            };

            const {elements, ...rest} = baseProps;
            elements?.push(selectElement);
            const props = {
                ...rest,
                elements,
            };

            renderWithContext(
                <InteractiveDialog {...props}/>,
            );

            expect(screen.getByPlaceholderText<HTMLInputElement>('test select').defaultValue).toEqual('Option3');
        });
    });

    describe('bool element in Interactive Dialog', () => {
        const element: TDialogElement = {
            data_source: '',
            display_name: 'Boolean Selector',
            name: 'somebool',
            optional: false,
            type: 'bool',
            placeholder: 'Subscribe?',
            subtype: '',
            default: '',
            help_text: '',
            min_length: 0,
            max_length: 0,
            options: [],
        };
        const {elements, ...rest} = baseProps;
        const props = {
            ...rest,
            elements: [
                ...elements || [],
                element,
            ],
        };

        const testCases = [
            {description: 'no default', expectedChecked: false},
            {description: 'unknown default', default: 'unknown', expectedChecked: false},
            {description: 'default of "false"', default: 'false', expectedChecked: false},
            {description: 'default of true', default: true, expectedChecked: true},
            {description: 'default of "true"', default: 'True', expectedChecked: true},
            {description: 'default of "True"', default: 'True', expectedChecked: true},
            {description: 'default of "TRUE"', default: 'TRUE', expectedChecked: true},
        ];

        testCases.forEach((testCase) => test(`should interpret ${testCase.description}`, () => {
            if (testCase.default === undefined) {
                delete (element as any).default;
            } else {
                (element as any).default = testCase.default;
            }

            renderWithContext(
                <InteractiveDialog {...props}/>,
            );
            expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toEqual(testCase.expectedChecked);
        }));
    });
});

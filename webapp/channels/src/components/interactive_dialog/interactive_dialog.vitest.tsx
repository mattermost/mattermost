// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DialogElement as TDialogElement} from '@mattermost/types/integrations';

import {renderWithContext, screen, fireEvent, act} from 'tests/vitest_react_testing_utils';
import EmojiMap from 'utils/emoji_map';

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
        onExited: vi.fn(),
        actions: {
            submitInteractiveDialog: vi.fn(),
            lookupInteractiveDialog: vi.fn(),
        },
        emojiMap: new EmojiMap(new Map()),
    };

    describe('generic error message', () => {
        test('should appear when submit returns an error', async () => {
            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: vi.fn().mockResolvedValue({data: {error: 'This is an error.'}}),
                    lookupInteractiveDialog: vi.fn(),
                },
            };

            renderWithContext(<InteractiveDialog {...props}/>);

            const submitButton = screen.getByText('Yes');
            await act(async () => {
                fireEvent.click(submitButton);
            });

            expect(screen.getByText('This is an error.')).toBeInTheDocument();
        });

        test('should not appear when submit does not return an error', async () => {
            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: vi.fn().mockResolvedValue({data: {}}),
                    lookupInteractiveDialog: vi.fn(),
                },
            };

            renderWithContext(<InteractiveDialog {...props}/>);

            const submitButton = screen.getByText('Yes');
            await act(async () => {
                fireEvent.click(submitButton);
            });

            expect(screen.queryByText('This is an error.')).not.toBeInTheDocument();
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
                placeholder: '',
                help_text: '',
                min_length: 0,
                max_length: 0,
            };

            const props = {
                ...baseProps,
                elements: [selectElement],
            };

            renderWithContext(<InteractiveDialog {...props}/>);

            // The select should have Option3 as default value
            const input = screen.getByDisplayValue('Option3');
            expect(input).toBeInTheDocument();
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
            const testElement = {...element};
            if (testCase.default === undefined) {
                delete (testElement as any).default;
            } else {
                (testElement as any).default = testCase.default;
            }

            const props = {
                ...baseProps,
                elements: [testElement],
            };

            renderWithContext(<InteractiveDialog {...props}/>);

            const checkbox = screen.getByRole('checkbox');
            if (testCase.expectedChecked) {
                expect(checkbox).toBeChecked();
            } else {
                expect(checkbox).not.toBeChecked();
            }
        }));
    });
});

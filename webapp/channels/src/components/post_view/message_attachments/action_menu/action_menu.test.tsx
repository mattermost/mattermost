// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntlAndStore, screen} from 'tests/react_testing_utils';

import ActionMenu from './action_menu';

describe('components/post_view/message_attachments/ActionMenu', () => {
    const baseProps = {
        postId: 'post1',
        action: {
            name: 'action',
            options: [
                {
                    text: 'One',
                    value: '1',
                },
                {
                    text: 'Two',
                    value: '2',
                },
            ],
            id: 'id',
            cookie: 'cookie',
        },
        selected: undefined,
        autocompleteChannels: jest.fn(),
        autocompleteUsers: jest.fn(),
        selectAttachmentMenuAction: jest.fn(),
    };

    test('should start with nothing selected', async () => {
        renderWithIntlAndStore(<ActionMenu {...baseProps}/>, {});

        const autoCompleteSelector = screen.getByTestId('autoCompleteSelector');
        const input = screen.getByPlaceholderText('action');

        expect(autoCompleteSelector).toBeInTheDocument();
        expect(autoCompleteSelector).toHaveClass('form-group');

        //if nothing is selected or selected is undefined, baseProps.selectAttachmentMenuAction should not be called
        expect(baseProps.selectAttachmentMenuAction).not.toHaveBeenCalled();

        expect(input).toHaveClass('form-control');
        expect(input).toHaveAttribute('value', '');
    });

    test('should set selected based on default option', () => {
        const props = {
            ...baseProps,
            action: {
                ...baseProps.action,
                default_option: '2',
            },
        };
        renderWithIntlAndStore(<ActionMenu {...props}/>, {});

        const input = screen.getByPlaceholderText('action');

        //default_option is given in props
        expect(input).toHaveAttribute('value', 'Two');
    });
});

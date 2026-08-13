// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import EditCategoryModal from './edit_category_modal';

describe('components/EditCategoryModal', () => {
    describe('isConfirmDisabled', () => {
        const requiredProps = {
            onExited: jest.fn(),
            currentTeamId: '42',
            actions: {
                createCategory: jest.fn(),
                renameCategory: jest.fn(),
            },
        };

        test.each([
            ['', true],
            ['Where is Jessica Hyde?', false],
            ['Some string with length more than 22', true],
        ])('when categoryName: %s, isConfirmDisabled should return %s', async (categoryName, expected) => {
            renderWithContext(<EditCategoryModal {...requiredProps}/>);

            const input = screen.getByPlaceholderText('Name your category');

            // Clear input and type new value
            if (categoryName) {
                await userEvent.clear(input);
                await userEvent.type(input, categoryName);
            }

            // Find the confirm button (Create button)
            const confirmButton = screen.getByRole('button', {name: 'Create'});

            if (expected) {
                expect(confirmButton).toBeDisabled();
            } else {
                expect(confirmButton).toBeEnabled();
            }
        });
    });
});

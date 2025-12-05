// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import EditCategoryModal from './edit_category_modal';

describe('components/EditCategoryModal', () => {
    describe('isConfirmDisabled', () => {
        const requiredProps = {
            onExited: vi.fn(),
            currentTeamId: '42',
            actions: {
                createCategory: vi.fn(),
                renameCategory: vi.fn(),
            },
        };

        test.each([
            ['', true],
            ['Where is Jessica Hyde?', false],
            ['Some string with length more than 22', true],
        ])('when categoryName: %s, isConfirmDisabled should return %s', (categoryName, expected) => {
            renderWithContext(<EditCategoryModal {...requiredProps}/>);

            // Find the input and type the category name
            const input = screen.getByRole('textbox');
            fireEvent.change(input, {target: {value: categoryName}});

            // Find the confirm button and check if it's disabled
            const confirmButton = screen.getByRole('button', {name: /create/i});
            expect(confirmButton.hasAttribute('disabled')).toBe(expected);
        });
    });
});

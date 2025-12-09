// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import UserAccountOutOfOfficeMenuItem, {type Props} from './user_account_out_of_office_menuitem';

const mockOpenModal = jest.fn();
jest.mock('actions/views/modals', () => ({
    openModal: (...args: unknown[]) => {
        mockOpenModal(...args);
        return {type: 'MOCK_OPEN_MODAL'};
    },
}));

describe('UserAccountOutOfOfficeMenuItem', () => {
    let defaultProps: Props;

    beforeEach(() => {
        mockOpenModal.mockClear();
        defaultProps = {
            userId: TestHelper.getUserMock().id,
            shouldConfirmBeforeStatusChange: false,
        };
    });

    test('should not render if status is not out of office', () => {
        const props = {...defaultProps, isStatusOutOfOffice: false};
        renderWithContext(<UserAccountOutOfOfficeMenuItem {...props}/>);

        expect(screen.queryByText('Out of office')).not.toBeInTheDocument();
    });

    test('should only render when status is out of office', () => {
        renderWithContext(<UserAccountOutOfOfficeMenuItem {...defaultProps}/>);

        expect(screen.getAllByText(/Out of office/).length).toBe(1);
        expect(screen.getAllByText(/Automatic replies are enabled/).length).toBe(1);
    });

    test('should open reset status modal when confirming before status change option is true', async () => {
        // Work around since in mobile menu's onClick get executed immediately and not so on non-mobile
        // see handleClick func of webapp/channels/src/components/menu/menu_item.tsx
        const initialState = {
            views: {
                browser: {
                    windowSize: WindowSizes.MOBILE_VIEW,
                },
            },
        };
        const props = {...defaultProps, shouldConfirmBeforeStatusChange: true};
        renderWithContext(<UserAccountOutOfOfficeMenuItem {...props}/>, initialState);

        await userEvent.click(screen.getByRole('menuitem'));

        expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });
});

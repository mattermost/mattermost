// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as modalActions from 'actions/views/modals';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import UserAccountOutOfOfficeMenuItem, {type Props} from './user_account_out_of_office_menuitem';

describe('UserAccountOutOfOfficeMenuItem', () => {
    let defaultProps: Props;

    beforeEach(() => {
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
        jest.spyOn(modalActions, 'openModal');

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

        userEvent.click(screen.getByRole('menuitem'));

        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
    });
});

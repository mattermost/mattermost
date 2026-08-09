// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as userActions from 'mattermost-redux/actions/users';

import * as modalActions from 'actions/views/modals';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {UserStatuses, WindowSizes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import UserAccountOnlineMenuItem from './user_account_online_menuitem';

type Props = React.ComponentProps<typeof UserAccountOnlineMenuItem>;

// Menu items only fire onClick immediately in the mobile view.
// See handleClick in webapp/channels/src/components/menu/menu_item.tsx
const mobileState = {
    views: {
        browser: {
            windowSize: WindowSizes.MOBILE_VIEW,
        },
    },
};

describe('UserAccountOnlineMenuItem', () => {
    let defaultProps: Props;

    beforeEach(() => {
        jest.clearAllMocks();

        defaultProps = {
            userId: TestHelper.getUserMock().id,
            shouldConfirmBeforeStatusChange: false,
            isStatusOnline: false,
        };
    });

    test('should render the online option', () => {
        renderWithContext(<UserAccountOnlineMenuItem {...defaultProps}/>);

        expect(screen.getByText('Online')).toBeInTheDocument();
    });

    test('should set status to online when clicked', async () => {
        jest.spyOn(userActions, 'setStatus');

        renderWithContext(<UserAccountOnlineMenuItem {...defaultProps}/>, mobileState);

        await userEvent.click(screen.getByRole('menuitem'));

        // Online must be explicitly settable like away, dnd and offline. The server treats
        // this call as a manual pin that overrides the automatic away transition.
        expect(userActions.setStatus).toHaveBeenCalledWith({
            user_id: defaultProps.userId,
            status: UserStatuses.ONLINE,
        });
    });

    test('should mark the option as checked when the user is online', () => {
        const props = {...defaultProps, isStatusOnline: true};
        renderWithContext(<UserAccountOnlineMenuItem {...props}/>);

        expect(screen.getByRole('menuitem')).toHaveAttribute('aria-checked', 'true');
    });

    test('should not mark the option as checked when the user is not online', () => {
        renderWithContext(<UserAccountOnlineMenuItem {...defaultProps}/>);

        expect(screen.getByRole('menuitem')).toHaveAttribute('aria-checked', 'false');
    });

    test('should open reset status modal instead of setting status when confirmation is required', async () => {
        jest.spyOn(modalActions, 'openModal');
        jest.spyOn(userActions, 'setStatus');

        const props = {...defaultProps, shouldConfirmBeforeStatusChange: true};
        renderWithContext(<UserAccountOnlineMenuItem {...props}/>, mobileState);

        await userEvent.click(screen.getByRole('menuitem'));

        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(userActions.setStatus).not.toHaveBeenCalled();
    });
});

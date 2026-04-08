// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {ProfilePopoverController} from './profile_popover_controller';

jest.mock('./profile_popover', () => ({
    __esModule: true,
    default: () => <div data-testid='profile-popover'>{'Profile Popover'}</div>,
}));

describe('components/profile_popover/ProfilePopoverController', () => {
    const baseProps = {
        userId: 'user-id',
        src: '/image.png',
        username: 'testuser',
        children: <span>{'@testuser'}</span>,
    };

    test('should set type="button" when rendered as button trigger', () => {
        renderWithContext(
            <form>
                <ProfilePopoverController
                    {...baseProps}
                    triggerComponentAs='button'
                />
            </form>,
        );

        expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
});

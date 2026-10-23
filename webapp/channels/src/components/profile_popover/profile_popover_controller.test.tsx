// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RootHtmlPortalId} from 'utils/constants';

import ProfilePopover from './index';

jest.mock('./profile_popover', () => ({
    __esModule: true,
    default: () => <div>{'profile'}</div>,
}));

describe('ProfilePopoverController', () => {
    test('button triggers use type=button so they do not submit parent forms', async () => {
        const handleSubmit = jest.fn((e: React.FormEvent) => {
            e.preventDefault();
        });

        renderWithContext(
            <form onSubmit={handleSubmit}>
                <div id={RootHtmlPortalId}/>
                <ProfilePopover
                    triggerComponentAs='button'
                    triggerComponentClass='style--none'
                    userId='user1'
                    src=''
                >
                    {'@user1'}
                </ProfilePopover>
            </form>,
        );

        const trigger = screen.getByRole('button', {name: '@user1'});
        expect(trigger).toHaveAttribute('type', 'button');

        await userEvent.click(trigger);

        expect(handleSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('user-profile-popover')).toBeInTheDocument();
    });
});

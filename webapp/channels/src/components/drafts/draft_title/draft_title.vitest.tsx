// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import * as usersActions from 'mattermost-redux/actions/users';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';

import DraftTitle from './draft_title';

vi.mock('mattermost-redux/actions/users', () => ({
    batchGetProfilesInChannel: vi.fn(() => ({type: 'MOCK_BATCH_GET_PROFILES'})),
    getMissingProfilesByIds: vi.fn(() => ({type: 'MOCK_GET_MISSING_PROFILES'})),
}));

describe('components/drafts/draft_actions', () => {
    const channel = {
        id: 'channel_id',
        type: 'O',
        display_name: 'Test Channel',
    } as Channel;

    const baseProps = {
        channel,
        membersCount: 5,
        selfDraft: false,
        teammate: {} as UserProfile,
        teammateId: '',
        type: 'channel' as 'channel' | 'thread',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <DraftTitle
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for self draft', () => {
        const props = {
            ...baseProps,
            selfDraft: true,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );

        // Should show "(you)" for self draft - FormattedMessage renders it
        expect(container.textContent).toContain('(you)');
    });

    it('should match snapshot for private channel', () => {
        const privateChannel = {
            ...channel,
            type: Constants.PRIVATE_CHANNEL,
        } as Channel;
        const props = {
            ...baseProps,
            channel: privateChannel,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );

        // Should show lock icon for private channel
        expect(container.querySelector('.icon-lock-outline')).toBeInTheDocument();
    });

    it('should match snapshot for DM channel', () => {
        const dmChannel = {
            ...channel,
            type: Constants.DM_CHANNEL,
        } as Channel;
        const props = {
            ...baseProps,
            channel: dmChannel,
        };

        renderWithContext(
            <DraftTitle
                {...props}
            />,
        );

        // Should show "To:" for DM channel
        expect(screen.getByText(/to:/i)).toBeInTheDocument();
    });

    it('should match snapshot for DM channel with teammate', () => {
        const dmChannel = {
            ...channel,
            type: Constants.DM_CHANNEL,
        } as Channel;
        const props = {
            ...baseProps,
            channel: dmChannel,
            teammate: {
                username: 'username',
                id: 'id',
                last_picture_update: 1000,
            } as UserProfile,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );

        // Should show avatar for DM channel with teammate
        expect(container.querySelector('.DraftTitle__avatar')).toBeInTheDocument();
    });

    it('should match snapshot for GM channel', () => {
        const gmChannel = {
            ...channel,
            type: 'G',
        } as Channel;

        const props = {
            ...baseProps,
            channel: gmChannel,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );

        // Should show group icon with members count
        expect(container.querySelector('.DraftTitle__group-icon')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should match snapshot for thread', () => {
        const openChannel = {
            ...channel,
            type: Constants.OPEN_CHANNEL,
        } as Channel;

        const props = {
            ...baseProps,
            channel: openChannel,
            type: 'thread' as 'channel' | 'thread',
        };

        renderWithContext(
            <DraftTitle
                {...props}
            />,
        );

        // Should show "Thread in:" for thread in channel
        expect(screen.getByText(/thread in:/i)).toBeInTheDocument();
    });

    it('should match snapshot for open channel', () => {
        const openChannel = {
            ...channel,
            type: Constants.OPEN_CHANNEL,
        } as Channel;

        const props = {
            ...baseProps,
            channel: openChannel,
            type: 'channel' as 'channel' | 'thread',
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );

        // Should show globe icon for open channel
        expect(container.querySelector('.icon-globe')).toBeInTheDocument();
        expect(screen.getByText(/in:/i)).toBeInTheDocument();
    });

    it('should fetch members when member count is 0 for GM', () => {
        const gmChannel = {
            ...channel,
            id: 'gm_channel_id',
            type: 'G',
        } as Channel;

        const props = {
            ...baseProps,
            channel: gmChannel,
            membersCount: 0,
            type: 'channel' as 'channel' | 'thread',
        };

        renderWithContext(
            <DraftTitle
                {...props}
            />,
        );

        // Should dispatch batchGetProfilesInChannel for GM with 0 members
        expect(usersActions.batchGetProfilesInChannel).toHaveBeenCalledWith('gm_channel_id');
    });
});

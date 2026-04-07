// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import DraftTitle from './draft_title';

describe('components/drafts/draft_actions', () => {
    const channel = {
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

    it('should match snapshot', async () => {
        const {container} = await renderWithContext(
            <DraftTitle
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for self draft', async () => {
        const props = {
            ...baseProps,
            selfDraft: true,
        };

        const {container} = await renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for private channel', async () => {
        const channel = {
            type: Constants.PRIVATE_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;
        const props = {
            ...baseProps,
            channel,
        };

        const {container} = await renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for DM channel', async () => {
        const channel = {
            type: Constants.DM_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;
        const props = {
            ...baseProps,
            channel,
        };

        const {container} = await renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for DM channel with teammate', async () => {
        const channel = {
            type: Constants.DM_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;
        const props = {
            ...baseProps,
            channel,
            teammate: {
                username: 'username',
                id: 'id',
                last_picture_update: 1000,
            } as UserProfile,
        };

        const {container} = await renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for GM channel', async () => {
        const channel = {
            type: 'G',
            display_name: 'Test Channel',
        } as Channel;

        const props = {
            ...baseProps,
            channel,
        };

        const {container} = await renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for thread', async () => {
        const channel = {
            type: Constants.OPEN_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            type: 'thread' as 'channel' | 'thread',
        };

        const {container} = await renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for open channel', async () => {
        const channel = {
            type: Constants.OPEN_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            type: 'channel' as 'channel' | 'thread',
        };

        const {container} = await renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should fetch members when member count is 0 for GM', async () => {
        const channel = {
            type: 'G',
            display_name: 'Test Channel',
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            membersCount: 0,
            type: 'channel' as 'channel' | 'thread',
        };

        const {container} = await renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});

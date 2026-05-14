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
        delete_at: 0,
    } as Channel;

    const baseProps = {
        channel,
        membersCount: 5,
        selfDraft: false,
        teammate: {} as UserProfile,
        teammateId: '',
        type: 'channel' as 'channel' | 'thread',
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <DraftTitle
                {...baseProps}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-globe');
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
        expect(container.querySelector('i.icon')).toHaveClass('icon-globe');
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for private channel', () => {
        const channel = {
            type: Constants.PRIVATE_CHANNEL,
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;
        const props = {
            ...baseProps,
            channel,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-lock-outline');
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for DM channel', () => {
        const channel = {
            type: Constants.DM_CHANNEL,
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;
        const props = {
            ...baseProps,
            channel,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for DM channel with teammate', () => {
        const channel = {
            type: Constants.DM_CHANNEL,
            display_name: 'Test Channel',
            delete_at: 0,
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

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for GM channel', () => {
        const channel = {
            type: 'G',
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;

        const props = {
            ...baseProps,
            channel,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for thread', () => {
        const channel = {
            type: Constants.OPEN_CHANNEL,
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            type: 'thread' as 'channel' | 'thread',
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-globe');
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for open channel', () => {
        const channel = {
            type: Constants.OPEN_CHANNEL,
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            type: 'channel' as 'channel' | 'thread',
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-globe');
        expect(container).toMatchSnapshot();
    });

    it('should fetch members when member count is 0 for GM', () => {
        const channel = {
            type: 'G',
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            membersCount: 0,
            type: 'channel' as 'channel' | 'thread',
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    describe('channel icon override', () => {
        const stateWithOverride = (overrides: any[]) => ({
            plugins: {components: {ChannelIconOverride: overrides}},
        } as any);

        it('renders icon-shield-outline for open channel when matcher matches', () => {
            const openChannel = {
                id: 'channel-1',
                type: Constants.OPEN_CHANNEL,
                display_name: 'Test Channel',
                delete_at: 0,
            } as Channel;

            const {container} = renderWithContext(
                <DraftTitle
                    {...baseProps}
                    channel={openChannel}
                />,
                stateWithOverride([{id: '1', pluginId: 'p', matcher: () => true, iconName: 'shield-outline'}]),
            );
            const icon = container.querySelector('i');
            expect(icon).toHaveClass('icon-shield-outline');
            expect(icon).not.toHaveClass('icon-globe');
        });

        it('falls back to icon-globe for open channel when matcher returns false', () => {
            const openChannel = {
                id: 'channel-1',
                type: Constants.OPEN_CHANNEL,
                display_name: 'Test Channel',
                delete_at: 0,
            } as Channel;

            const {container} = renderWithContext(
                <DraftTitle
                    {...baseProps}
                    channel={openChannel}
                />,
                stateWithOverride([{id: '1', pluginId: 'p', matcher: () => false, iconName: 'shield-outline'}]),
            );
            const icon = container.querySelector('i');
            expect(icon).toHaveClass('icon-globe');
            expect(icon).not.toHaveClass('icon-shield-outline');
        });

        it('falls back to icon-lock-outline for private channel when matcher returns false', () => {
            const privateChannel = {
                id: 'channel-1',
                type: Constants.PRIVATE_CHANNEL,
                display_name: 'Test Channel',
                delete_at: 0,
            } as Channel;

            const {container} = renderWithContext(
                <DraftTitle
                    {...baseProps}
                    channel={privateChannel}
                />,
                stateWithOverride([{id: '1', pluginId: 'p', matcher: () => false, iconName: 'shield-outline'}]),
            );
            const icon = container.querySelector('i');
            expect(icon).toHaveClass('icon-lock-outline');
        });
    });
});

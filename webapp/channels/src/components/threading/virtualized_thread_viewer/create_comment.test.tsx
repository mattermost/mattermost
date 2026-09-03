// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {DeepPartial} from '@mattermost/types/utilities';

import {compassIconForName} from 'components/channel_type_icon';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import CreateComment from './create_comment';

jest.mock('components/channel_type_icon/compass_icon_resolver', () => ({
    compassIconForName: jest.fn(),
}));

jest.mock('components/advanced_create_comment', () => () => <div data-testid='advanced-create-comment'/>);

function makeState(channel: Channel, threadId: string, overrides: any[] = []): DeepPartial<GlobalState> {
    const post = TestHelper.getPostMock({id: threadId, channel_id: channel.id});
    return {
        entities: {
            channels: {
                channels: {[channel.id]: channel},
                myMembers: {},
                roles: {},
            },
            posts: {
                posts: {[post.id]: post},
                postsInChannel: {},
                postsInThread: {},
                reactions: {},
                openGraph: {},
                selectedPostId: '',
                currentFocusedPostId: '',
                messagesHistory: {messages: [], index: {}},
            },
            general: {config: {}},
            preferences: {myPreferences: {}},
            users: {currentUserId: 'user1', profiles: {}},
        },
        plugins: {
            components: {ChannelIconOverride: overrides},
        },
        views: {
            threads: {
                selectedThreadIdInTeam: {},
            },
        },
    } as any;
}

describe('components/threading/CreateComment', () => {
    const threadId = 'thread-1';
    const mockedCompassIconForName = jest.mocked(compassIconForName);

    afterEach(() => {
        mockedCompassIconForName.mockReset();
    });

    it('renders archived warning for archived channel', () => {
        const channel = TestHelper.getChannelMock({
            id: 'ch-1',
            type: 'O',
            delete_at: 1234,
        });

        renderWithContext(
            <CreateComment threadId={threadId}/>,
            makeState(channel, threadId),
        );

        expect(screen.getByText(/archived channel/i)).toBeInTheDocument();
    });

    it('renders override SVG icon when plugin matcher matches', () => {
        const StubIcon = ({size, color}: {size?: number; color?: string}) => (
            <svg
                data-testid='stub-override-icon'
                data-size={size}
                data-color={color}
            />
        );
        mockedCompassIconForName.mockReturnValue(StubIcon as any);

        const channel = TestHelper.getChannelMock({
            id: 'ch-1',
            type: 'O',
            delete_at: 1234,
        });

        renderWithContext(
            <CreateComment threadId={threadId}/>,
            makeState(channel, threadId, [{id: '1', pluginId: 'p', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = screen.getByTestId('stub-override-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('data-size', '20');

        // Override icon gets the same greyed color as the default archive icon
        expect(icon).toHaveAttribute('data-color', 'rgba(var(--center-channel-color-rgb), 0.75)');
    });

    it('renders fallback SVG archive icon when matcher returns false', () => {
        mockedCompassIconForName.mockReturnValue(null);

        const channel = TestHelper.getChannelMock({
            id: 'ch-1',
            type: 'O',
            delete_at: 1234,
        });

        const {container} = renderWithContext(
            <CreateComment threadId={threadId}/>,
            makeState(channel, threadId, [{id: '1', pluginId: 'p', matcher: () => false, iconName: 'shield-outline'}]),
        );

        expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
        expect(container.querySelector('.channel-archived-warning__content svg')).toBeInTheDocument();
    });

    it('renders create comment form for non-archived channel', () => {
        const channel = TestHelper.getChannelMock({
            id: 'ch-1',
            type: 'O',
            delete_at: 0,
        });

        renderWithContext(
            <CreateComment threadId={threadId}/>,
            makeState(channel, threadId),
        );

        expect(screen.getByTestId('advanced-create-comment')).toBeInTheDocument();
    });

    it('renders ChannelComposerBanner component above the thread composer', () => {
        const channel = TestHelper.getChannelMock({
            id: 'ch-1',
            type: 'O',
            delete_at: 0,
        });

        const state = {
            ...makeState(channel, threadId),
            plugins: {
                components: {
                    ChannelIconOverride: [],
                    ChannelComposerBanner: [{
                        id: 'banner-1',
                        pluginId: 'test-plugin',
                        component: () => <div data-testid='composer-banner-content'/>,
                    }],
                },
            },
        } as any;

        renderWithContext(
            <CreateComment threadId={threadId}/>,
            state,
        );

        expect(screen.getByTestId('composer-banner-content')).toBeInTheDocument();
    });
});

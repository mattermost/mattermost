// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import ChannelView from './channel_view';
import type {Props} from './channel_view';

describe('components/channel_view', () => {
    const baseProps: Props = {
        channelId: 'channelId',
        deactivatedChannel: false,
        history: {} as Props['history'],
        location: {} as Props['location'],
        match: {
            url: '/team/channel/channelId',
            params: {},
        } as Props['match'],
        enableOnboardingFlow: true,
        teamUrl: '/team',
        channelIsArchived: false,
        isCloud: false,
        goToLastViewedChannel: vi.fn(),
        isFirstAdmin: false,
        enableWebSocketEventScope: false,
        isChannelBookmarksEnabled: false,
        missingChannelRole: false,
        fetchIsRestrictedDM: vi.fn(),
        canRestrictDirectMessage: false,
        restrictDirectMessage: false,
    };

    it('Should match snapshot with base props', () => {
        const {container} = renderWithContext(<ChannelView {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    it('Should match snapshot if channel is archived', () => {
        const {container} = renderWithContext(
            <ChannelView
                {...baseProps}
                channelIsArchived={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('Should match snapshot if channel is deactivated', () => {
        const {container} = renderWithContext(
            <ChannelView
                {...baseProps}
                deactivatedChannel={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('Should have focusedPostId state based on props', () => {
        const {rerender} = renderWithContext(<ChannelView {...baseProps}/>);

        // Rerender with new props to trigger the state update
        rerender(
            <ChannelView
                {...baseProps}
                channelId='newChannelId'
                match={{url: '/team/channel/channelId/postId', params: {postid: 'postid'}} as Props['match']}
            />,
        );

        rerender(
            <ChannelView
                {...baseProps}
                channelId='newChannelId'
                match={{url: '/team/channel/channelId/postId1', params: {postid: 'postid1'}} as Props['match']}
            />,
        );
    });

    it('should call fetchRecentMentions on componentDidUpdate', () => {
        const fetchIsRestrictedDM = vi.fn();
        const {rerender} = renderWithContext(
            <ChannelView
                {...baseProps}
                canRestrictDirectMessage={true}
                restrictDirectMessage={undefined as any}
                fetchIsRestrictedDM={fetchIsRestrictedDM}
            />,
        );

        rerender(
            <ChannelView
                {...baseProps}
                channelId='newChannelId'
                canRestrictDirectMessage={true}
                restrictDirectMessage={undefined as any}
                fetchIsRestrictedDM={fetchIsRestrictedDM}
            />,
        );

        expect(fetchIsRestrictedDM).toHaveBeenCalledTimes(1);
    });
});

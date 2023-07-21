// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ChannelView, {Props} from './channel_view';

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
        viewArchivedChannels: false,
        isCloud: false,
        goToLastViewedChannel: jest.fn(),
        isFirstAdmin: false,
    };

    it('Should match snapshot with base props', () => {
        const wrapper = shallow(<ChannelView {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('Should match snapshot if channel is archived', () => {
        const wrapper = shallow(
            <ChannelView
                {...baseProps}
                channelIsArchived={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('Should match snapshot if channel is deactivated', () => {
        const wrapper = shallow(
            <ChannelView
                {...baseProps}
                deactivatedChannel={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('Should have focusedPostId state based on props', () => {
        const wrapper = shallow(<ChannelView {...baseProps}/>);
        expect(wrapper.state('focusedPostId')).toEqual(undefined);

        wrapper.setProps({channelId: 'newChannelId', match: {url: '/team/channel/channelId/postId', params: {postid: 'postid'}}});
        expect(wrapper.state('focusedPostId')).toEqual('postid');
        wrapper.setProps({channelId: 'newChannelId', match: {url: '/team/channel/channelId/postId1', params: {postid: 'postid1'}}});
        expect(wrapper.state('focusedPostId')).toEqual('postid1');
    });
});

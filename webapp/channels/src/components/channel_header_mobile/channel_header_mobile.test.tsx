// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import ChannelHeaderMobile from './channel_header_mobile';

describe('components/ChannelHeaderMobile/ChannelHeaderMobile', () => {
    global.document.querySelector = jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    });

    const baseProps = {
        user: TestHelper.getUserMock({
            id: 'user_id',
        }),
        channel: TestHelper.getChannelMock({
            type: 'O',
            id: 'channel_id',
            display_name: 'display_name',
            team_id: 'team_id',
        }),
        member: TestHelper.getChannelMembershipMock({
            channel_id: 'channel_id',
            user_id: 'user_id',
        }),
        teamDisplayName: 'team_display_name',
        isPinnedPosts: true,
        actions: {
            closeLhs: jest.fn(),
            closeRhs: jest.fn(),
            closeRhsMenu: jest.fn(),
        },
        isLicensed: true,
        isMobileView: false,
        isFavoriteChannel: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ChannelHeaderMobile {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, for default channel', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'O',
                id: '123',
                name: 'town-square',
                display_name: 'Town Square',
                team_id: 'team_id',
            }),
        };
        const wrapper = shallow(
            <ChannelHeaderMobile {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, if DM channel', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'D',
                id: 'channel_id',
                name: 'user_id_1__user_id_2',
                display_name: 'display_name',
                team_id: 'team_id',
            }),
        };
        const wrapper = shallow(<ChannelHeaderMobile {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, for private channel', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'P',
                id: 'channel_id',
                display_name: 'display_name',
                team_id: 'team_id',
            }),
        };
        const wrapper = shallow(<ChannelHeaderMobile {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });
});

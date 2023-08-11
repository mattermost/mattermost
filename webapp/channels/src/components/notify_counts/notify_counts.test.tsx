// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mount} from 'enzyme';

import * as ChannelSelectors from 'mattermost-redux/selectors/entities/channels';

import {mockStore} from 'tests/test_store';

import NotifyCounts from './';

describe('components/notify_counts', () => {
    const getUnreadStatusInCurrentTeam = jest.spyOn(ChannelSelectors, 'getUnreadStatusInCurrentTeam');

    test('should show unread mention count', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(22);

        const {mountOptions} = mockStore();
        const wrapper = mount(<NotifyCounts/>, mountOptions);

        expect(wrapper.find('.badge-notify').text()).toBe('22');
    });

    test('should show unread messages', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(true);

        const {mountOptions} = mockStore();
        const wrapper = mount(<NotifyCounts/>, mountOptions);

        expect(wrapper.find('.badge-notify').text()).toBe('•');
    });

    test('should show not show unread indicator', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(false);

        const {mountOptions} = mockStore();
        const wrapper = mount(<NotifyCounts/>, mountOptions);

        expect(wrapper.isEmptyRender()).toBe(true);
    });
});

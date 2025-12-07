// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';

import {mockStore} from 'tests/test_store';

import NotifyCounts from './';

const mockGetUnreadStatusInCurrentTeam = jest.fn();

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getUnreadStatusInCurrentTeam: (...args: any[]) => mockGetUnreadStatusInCurrentTeam(...args),
    basicUnreadMeta: jest.fn((status) => {
        if (typeof status === 'number') {
            return {unreadMentionCount: status, isUnread: true};
        }
        return {unreadMentionCount: 0, isUnread: Boolean(status)};
    }),
}));

describe('components/notify_counts', () => {
    test('should show unread mention count', () => {
        mockGetUnreadStatusInCurrentTeam.mockReturnValue(22);

        const {mountOptions} = mockStore();
        const wrapper = mount(<NotifyCounts/>, mountOptions);

        expect(wrapper.find('.badge-notify').text()).toBe('22');
    });

    test('should show unread messages', () => {
        mockGetUnreadStatusInCurrentTeam.mockReturnValue(true);

        const {mountOptions} = mockStore();
        const wrapper = mount(<NotifyCounts/>, mountOptions);

        expect(wrapper.find('.badge-notify').text()).toBe('•');
    });

    test('should show not show unread indicator', () => {
        mockGetUnreadStatusInCurrentTeam.mockReturnValue(false);

        const {mountOptions} = mockStore();
        const wrapper = mount(<NotifyCounts/>, mountOptions);

        expect(wrapper.html()).toBe('');
    });
});

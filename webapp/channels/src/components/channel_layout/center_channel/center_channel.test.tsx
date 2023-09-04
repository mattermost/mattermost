// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import CenterChannel from './center_channel';

import type {OwnProps} from './index';

describe('components/channel_layout/CenterChannel', () => {
    const props = {
        location: {
            pathname: '/some',
        } as OwnProps['location'],
        match: {
            url: '/url',
        } as OwnProps['match'],
        history: {} as OwnProps['history'],
        lastChannelPath: '',
        lhsOpen: true,
        rhsOpen: true,
        rhsMenuOpen: true,
        isCollapsedThreadsEnabled: true,
        currentUserId: 'testUserId',
        isMobileView: false,
        actions: {
            getProfiles: jest.fn,
        },
    };
    test('should call update returnTo on props change', () => {
        const wrapper = shallow(<CenterChannel {...props}/>);

        expect(wrapper.state('returnTo')).toBe('');

        wrapper.setProps({
            location: {
                pathname: '/pl/path',
            },
        });
        expect(wrapper.state('returnTo')).toBe('/some');
        wrapper.setProps({
            location: {
                pathname: '/pl/path1',
            },
        });
        expect(wrapper.state('returnTo')).toBe('/pl/path');
    });
});

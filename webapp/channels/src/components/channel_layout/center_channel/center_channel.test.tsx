// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
            getProfiles: jest.fn(),
        },
    };
    test('should call update returnTo on props change', () => {
        let state = {returnTo: '', lastReturnTo: ''};

        // Simulate initial render with pathname '/some'
        let derived = CenterChannel.getDerivedStateFromProps(props as any, state);
        state = {...state, ...derived};
        expect(state.returnTo).toBe('');

        // Simulate props change to '/pl/path'
        derived = CenterChannel.getDerivedStateFromProps(
            {...props, location: {pathname: '/pl/path'}} as any,
            state,
        );
        state = {...state, ...derived};
        expect(state.returnTo).toBe('/some');

        // Simulate props change to '/pl/path1'
        derived = CenterChannel.getDerivedStateFromProps(
            {...props, location: {pathname: '/pl/path1'}} as any,
            state,
        );
        state = {...state, ...derived};
        expect(state.returnTo).toBe('/pl/path');
    });
});

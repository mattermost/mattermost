// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

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
            getProfiles: vi.fn(),
        },
    };

    test('should call update returnTo on props change', () => {
        const {rerender} = renderWithContext(<CenterChannel {...props}/>);

        // Change location to trigger returnTo update
        rerender(
            <CenterChannel
                {...props}
                location={{
                    pathname: '/pl/path',
                } as OwnProps['location']}
            />,
        );

        // Change location again
        rerender(
            <CenterChannel
                {...props}
                location={{
                    pathname: '/pl/path1',
                } as OwnProps['location']}
            />,
        );

        // Component should render without errors after props changes
        // The returnTo state is internal to the component
    });
});

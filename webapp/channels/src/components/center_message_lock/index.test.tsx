// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {emptyLimits} from 'tests/constants/cloud';
import {emptyTeams} from 'tests/constants/teams';
import {screen, renderWithContext} from 'tests/react_testing_utils';
import {makeEmptyUsage} from 'utils/limits_test';
import {TestHelper} from 'utils/test_helper';

import CenterMessageLock from './';

jest.mock('mattermost-redux/actions/cloud', () => {
    const actual = jest.requireActual('mattermost-redux/actions/cloud');

    return {
        ...actual,
        getCloudLimits: jest.fn(),
    };
});

const initialState = {
    entities: {
        usage: makeEmptyUsage(),
        cloud: {
            limits: {...emptyLimits(), limitsLoaded: false},
        },
        general: {
            license: TestHelper.getCloudLicenseMock(),
        },
        teams: emptyTeams(),
        limits: {
            serverLimits: {
                activeUserCount: 0,
                maxUsersLimit: 0,
            },
        },
        posts: {
            postsInChannel: {
                channelId: [
                    {
                        order: ['a', 'b', 'c'],
                        oldest: true,
                    },
                ],
            },
            posts: {
                a: TestHelper.getPostMock({id: 'a', create_at: 3}),
                b: TestHelper.getPostMock({id: 'b', create_at: 2}),
                c: TestHelper.getPostMock({id: 'c', create_at: 1}),
            },
        },
    },
};

const exceededLimitsState = {
    ...initialState,
    entities: {
        ...initialState.entities,
        limits: {
            serverLimits: {
                activeUserCount: 0,
                maxUsersLimit: 0,
                postHistoryLimit: 2,
            },
        },
    },
};

const exceededLimitsStateNoAccessiblePosts = {
    ...exceededLimitsState,
    entities: {
        ...exceededLimitsState.entities,
        posts: {
            postsInChannel: {
                channelId: [
                ],
            },
            posts: {},
        },
    },
};

describe('CenterMessageLock', () => {
    it('returns null if limits not loaded', () => {
        renderWithContext(
            <CenterMessageLock channelId={'channelId'}/>,
            initialState,
        );
        expect(screen.queryByText('Unlock messages prior to')).not.toBeInTheDocument();
    });

    it('shows message when limits are exceeded', () => {
        renderWithContext(
            <CenterMessageLock channelId={'channelId'}/>,
            exceededLimitsState,
        );
        screen.getByText('Unlock messages prior to', {exact: false});
        screen.getByText('Review our plan options and pricing.');
    });

    it('pricing button is clickable', () => {
        renderWithContext(
            <CenterMessageLock channelId={'channelId'}/>,
            exceededLimitsState,
        );
        const pricingButton = screen.getByText('Review our plan options and pricing.');
        expect(pricingButton.tagName).toBe('A');
        expect(pricingButton).toHaveClass('btn-link');
    });

    it('Filtered messages over one year old display year', () => {
        renderWithContext(
            <CenterMessageLock channelId={'channelId'}/>,
            exceededLimitsState,
        );
        screen.getByText('January 1, 1970', {exact: false});
    });

    it('New filtered messages do not show year', () => {
        const state = JSON.parse(JSON.stringify(exceededLimitsState));
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const expectedDate = firstOfMonth.toLocaleString('en', {month: 'long', day: 'numeric'});

        state.entities.posts.posts.c.create_at = Date.parse(firstOfMonth.toUTCString());
        renderWithContext(
            <CenterMessageLock channelId={'channelId'}/>,
            state,
        );
        screen.getByText(expectedDate, {exact: false});
    });

    it('when there are no messages, uses day after day of most recently archived post', () => {
        const now = Date.now();
        const secondOfMonth = new Date(now + (1000 * 60 * 60 * 24));
        const expectedDate = secondOfMonth.toLocaleString('en', {month: 'long', day: 'numeric'});

        renderWithContext(
            <CenterMessageLock
                channelId={'channelId'}
                firstInaccessiblePostTime={now}
            />,
            exceededLimitsStateNoAccessiblePosts,
        );
        screen.getByText(expectedDate, {exact: false});
    });
});

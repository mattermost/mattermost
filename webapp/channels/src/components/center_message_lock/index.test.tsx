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

describe('CenterMessageLock', () => {
    it('shows message when limits are exceeded', () => {
        renderWithContext(
            <CenterMessageLock/>,
            exceededLimitsState,
        );
        screen.getByText('Limited history is displayed', {exact: false});
        screen.getByText('Full access to message history is included in');
    });

    it('pricing link is clickable', () => {
        renderWithContext(
            <CenterMessageLock/>,
            exceededLimitsState,
        );
        const pricingLink = screen.getByText('paid plans');
        expect(pricingLink.tagName).toBe('A');
        expect(pricingLink).toHaveAttribute('href', '#');
        expect(pricingLink).toBeVisible();
    });
});

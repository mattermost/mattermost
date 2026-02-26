// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {CreateTeam} from './create_team';

describe('component/create_team', () => {
    const baseProps = {
        currentChannel: {},
        currentTeam: {},
        customDescriptionText: '',
        match: {
            url: '',
        },
        siteName: '',
        isCloud: false,
        isFreeTrial: false,
        usageDeltas: {
            teams: {
                active: -1,
            },
        },
        history: jest.fn(),
        location: jest.fn(),
        intl: {formatMessage: jest.fn()},
    } as any;

    test('should match snapshot default', () => {
        const {container} = renderWithContext(
            <CreateTeam {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show title and message when cloud and team limit reached', () => {
        const props = {
            ...baseProps,
            isCloud: true,
            isFreeTrial: false,
            usageDeltas: {
                teams: {
                    active: 0,
                },
            },
        };

        renderWithContext(
            <CreateTeam {...props}/>,
        );

        expect(screen.getByText('Professional feature')).toBeInTheDocument();
        expect(screen.getByText('Your workspace plan has reached the limit on the number of teams. Create unlimited teams with a free 30-day trial. Contact your System Administrator.')).toBeInTheDocument();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

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
        const wrapper = shallow(
            <CreateTeam {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
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

        const wrapper = shallow(
            <CreateTeam {...props}/>,
        );

        expect(wrapper.contains(
            <FormattedMessage
                id='create_team.createTeamRestricted.title'
                tagName='strong'
                defaultMessage='Professional feature'
            />,
        )).toEqual(true);
        expect(wrapper.contains(
            <FormattedMessage
                id='create_team.createTeamRestricted.message'
                defaultMessage='Your workspace plan has reached the limit on the number of teams. Create unlimited teams with a free 30-day trial. Contact your System Administrator.'
            />,
        )).toEqual(true);
    });
});

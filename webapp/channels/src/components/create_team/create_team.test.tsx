// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import CreateTeam from './create_team';

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
    } as any;

    test('should match snapshot default', () => {
        const wrapper = shallow(
            <CreateTeam {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});

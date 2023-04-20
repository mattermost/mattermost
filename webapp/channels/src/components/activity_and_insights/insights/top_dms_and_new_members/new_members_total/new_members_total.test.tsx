// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {TimeFrames} from '@mattermost/types/insights';

import NewMembersTotal from './new_members_total';

describe('components/activity_and_insights/insights/top_dms_and_new_members/new_members_total', () => {
    const props = {
        total: 2,
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        openInsightsModal: jest.fn(),
    };

    test('should match snapshot with team', () => {
        const wrapper = shallow(
            <NewMembersTotal
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimeFrames} from '@mattermost/types/insights';
import {shallow} from 'enzyme';
import React from 'react';

import TimeFrameDropdown from './time_frame_dropdown';

describe('components/activity_and_insights/insights/insights_title', () => {
    const props = {
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        setTimeFrame: jest.fn(),
    };

    test('should match snapshot with data', () => {
        const wrapper = shallow(
            <TimeFrameDropdown
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});

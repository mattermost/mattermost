// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import TopReactionsBarChart from './top_reactions_bar_chart';

describe('components/activity_and_insights/insights/top_reactions/top_reactions_bar_chart', () => {
    const props = {
        reactions: [
            {
                emoji_name: 'grinning',
                count: 190,
            },
            {
                emoji_name: 'tada',
                count: 180,
            },
            {
                emoji_name: 'heart',
                count: 110,
            },
            {
                emoji_name: 'laughing',
                count: 80,
            },
            {
                emoji_name: '+1',
                count: 40,
            },
        ],
    };

    test('should match snapshot with team', () => {
        const wrapper = shallow(
            <TopReactionsBarChart
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});

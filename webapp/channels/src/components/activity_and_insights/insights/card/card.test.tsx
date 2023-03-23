// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {CardSizes} from '@mattermost/types/insights';

import InsightsCard from './card';

describe('components/activity_and_insights/insights/insights_title', () => {
    const props = {
        class: '',
        children: <></>,
        title: '',
        subTitle: '',
        size: CardSizes.small,
        onClick: jest.fn(),
    };

    test('should match snapshot with no data', () => {
        const wrapper = shallow(
            <InsightsCard
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with data', () => {
        const wrapper = shallow(
            <InsightsCard
                {...props}
                class='top-channels-card'
                title='Top channels'
                subTitle='Top channels subtitle'
            >
                {'test data'}
            </InsightsCard>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});

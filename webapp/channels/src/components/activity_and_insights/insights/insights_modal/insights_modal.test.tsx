// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {InsightsWidgetTypes, TimeFrames} from '@mattermost/types/insights';
import {shallow} from 'enzyme';
import React from 'react';

import InsightsModal from './insights_modal';

describe('components/activity_and_insights/insights/insights_modal', () => {
    const props = {
        filterType: 'TEAM',
        onExited: jest.fn(),
        widgetType: InsightsWidgetTypes.TOP_REACTIONS,
        title: 'Top reactions',
        subtitle: 'The team\'s most-used reactions',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        setShowModal: jest.fn(),
    };

    test('should match snapshot with team', () => {
        const wrapper = shallow(
            <InsightsModal
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with My insights', () => {
        const wrapper = shallow(
            <InsightsModal
                {...props}
                filterType={'MY'}
                title={'My top reactions'}
                subtitle={'Reactions I\'ve used the most'}
                timeFrame={TimeFrames.INSIGHTS_1_DAY}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});

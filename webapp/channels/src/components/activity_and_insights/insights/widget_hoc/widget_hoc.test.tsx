// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentType} from 'react';
import {Provider} from 'react-redux';

import {CardSizes, InsightsWidgetTypes, TimeFrames} from '@mattermost/types/insights';

import {renderWithIntl, screen} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import {InsightsScopes} from 'utils/constants';

import widgetHoc from './widget_hoc';

describe('components/activity_and_insights/insights/widget_hoc', () => {
    let TestComponent: ComponentType;
    const store = mockStore({});

    const props = {
        size: CardSizes.small,
        widgetType: InsightsWidgetTypes.TOP_REACTIONS,
        filterType: InsightsScopes.MY,
        class: 'top-reactions-card',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        timeFrameLabel: 'Last 7 days',
    };

    beforeEach(() => {
        TestComponent = () => <div/>;
    });

    test('should display my top reactions', () => {
        const EnhancedComponent = widgetHoc(TestComponent);

        renderWithIntl(
            <Provider store={store}>
                <EnhancedComponent
                    {...props}
                />
            </Provider>,
        );

        expect(screen.getByText('My top reactions')).toBeInTheDocument();
        expect(screen.getByText('Reactions I\'ve used the most')).toBeInTheDocument();
    });

    test('should display team top reactions', () => {
        const EnhancedComponent = widgetHoc(TestComponent);

        renderWithIntl(
            <Provider store={store}>
                <EnhancedComponent
                    {...props}
                    filterType={InsightsScopes.TEAM}
                />
            </Provider>,
        );

        expect(screen.getByText('Top reactions')).toBeInTheDocument();
        expect(screen.getByText('The team\'s most-used reactions')).toBeInTheDocument();
    });
});

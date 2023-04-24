// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import classNames from 'classnames';

import './activity_and_insights.scss';

import Insights from './insights/insights';

const ActivityAndInsights = () => {
    /**
     * Here we can do a check to see if both insights and activity are enabled. If that condition is true we can render the tabbed header.
     * Otherwise we can render either insights or activity based on which flag is enabled.
     */
    return (
        <div
            id='app-content'
            className={classNames('ActivityAndInsights app__content')}
        >
            <Insights/>
        </div>
    );
};

export default memo(ActivityAndInsights);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimeFrame, TimeFrames} from '@mattermost/types/insights';
import React, {memo, useCallback} from 'react';

import {localizeMessage} from 'utils/utils';

import './../../../activity_and_insights.scss';

type Props = {
    total: number;
    timeFrame: TimeFrame;
    openInsightsModal: () => void;
}

const NewMembersTotal = ({total, timeFrame, openInsightsModal}: Props) => {
    const timeFrameInfo = useCallback(() => {
        switch (timeFrame) {
        case TimeFrames.INSIGHTS_1_DAY:
            return localizeMessage('insights.newMembers.today', 'Joined the team today');
        case TimeFrames.INSIGHTS_7_DAYS:
            return localizeMessage('insights.newMembers.lastSevenDays', 'Joined the team in the last 7 days');
        case TimeFrames.INSIGHTS_28_DAYS:
            return localizeMessage('insights.newMembers.lastTwentyEightDays', 'Joined the team in the last 28 days');
        default:
            return localizeMessage('insights.newMembers.lastSevenDays', 'Joined the team in the last 7 days');
        }
    }, [timeFrame]);

    return (
        <div className='new-members-item new-members-info'>
            <span className='total-count'>{total}</span>
            <div className='members-info'>
                <span className='time-range-info'>
                    {timeFrameInfo()}
                </span>
                <button
                    className='see-all-button'
                    onClick={(e) => {
                        e.stopPropagation();
                        openInsightsModal();
                    }}
                >
                    {localizeMessage('insights.newMembers.seeAll', 'See all')}
                    <i className='icon icon-chevron-right'/>
                </button>
            </div>

        </div>
    );
};

export default memo(NewMembersTotal);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';

import InsightsTitle from '../insights_title/insights_title';
import TimeFrameDropdown from '../time_frame_dropdown/time_frame_dropdown';

import './insights_header.scss';

type SelectOption = {
    value: string;
    label: string;
}

type Props = {
    filterType: string;
    setFilterTypeTeam: () => void;
    setFilterTypeMy: () => void;
    timeFrame: string;
    setTimeFrame: (value: SelectOption) => void;
}

const InsightsHeader = (props: Props) => {
    return (
        <header
            className={classNames('Header Insights___header')}
        >
            <div className='left'>
                <InsightsTitle
                    filterType={props.filterType}
                    setFilterTypeTeam={props.setFilterTypeTeam}
                    setFilterTypeMy={props.setFilterTypeMy}
                />
            </div>
            <div className='right'>
                <TimeFrameDropdown
                    timeFrame={props.timeFrame}
                    setTimeFrame={props.setTimeFrame}
                />
            </div>
        </header>
    );
};

export default memo(InsightsHeader);

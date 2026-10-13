// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ProgressBar} from '@mattermost/compass-ui/components/progress-bar';

type Props = {

    // 0-100, i.e. not a 0-1 decimal
    percent: number;
    barWidth?: number | string;
};

const UsagePercentBar = ({percent, barWidth = 155}: Props) => {
    const width = typeof barWidth === 'number' ? `${barWidth}px` : barWidth;

    return (
        <ProgressBar
            value={Math.max(0, percent)}
            size='large'
            semanticColors={true}
            style={{width}}
        />
    );
};

export default UsagePercentBar;

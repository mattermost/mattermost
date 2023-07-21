// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CheckIcon, ExclamationThickIcon} from '@mattermost/compass-icons/components';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import CircularChart from 'components/common/circular_chart/circular_chart';

import './dashboard.scss';

type OverallScoreProps = {
    title?: React.ReactNode;
    description?: React.ReactNode;
    chips: React.ReactNode;
    chartValue: number;
};

const OverallScore = ({
    chips,
    title,
    description,
    chartValue,
}: OverallScoreProps): JSX.Element | null => {
    const contentTitle = title || (
        <FormattedMessage
            id='admin.reporting.workspace_optimization.overall_workspace_score'
            defaultMessage='Overall Score'
        />
    );
    const contentDescription = description || (
        <FormattedMessage
            id='admin.reporting.workspace_optimization.overall_workspace_score_description'
            defaultMessage='Stay on top of optimizing your Mattermost workspace by reviewing your overall score below based on our recommended indicators of health and growth. Ensure your workspace is running smoothly so your users can get the most out of Mattermost.'
        />
    );

    let scoreGraph;

    switch (chartValue) {
    case 0:
        scoreGraph = (
            <div className='alertImageScore'>
                <ExclamationThickIcon
                    size={48}
                    color={'var(--sys-dnd-indicator)'}
                />
            </div>
        );
        break;
    case 100:
        scoreGraph = (
            <div className='successImageScore'>
                <CheckIcon
                    size={48}
                    color={'var(--sys-online-indicator)'}
                />
            </div>
        );
        break;
    default:
        scoreGraph = (
            <CircularChart
                value={chartValue}
                isPercentage={false}
                width={140}
                height={140}
                type={'success'}
            />
        );
        break;
    }
    return (
        <div className='OverallScore'>
            <div className='OverallScore__scoreEllipseSvg'>
                {scoreGraph}
            </div>
            <div className='OverallScore__content'>
                <div className='OverallScore__content__title'>
                    {contentTitle}
                </div>
                <div className='OverallScore__content__description'>
                    {contentDescription}
                </div>
                <div className='OverallScore__content__chips'>
                    {chips}
                </div>
            </div>
        </div>
    );
};

export default OverallScore;

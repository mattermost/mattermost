// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';

import StatisticCount from 'components/analytics/statistic_count';

import {calculateOverageUserActivated} from 'utils/overage_team';

import Title from './title';

type ActivatedUserCardProps = {
    seatsPurchased: number;
    activatedUsers: number | undefined;
    isCloud: boolean;
}

const ActivatedUserCard = ({activatedUsers, seatsPurchased, isCloud}: ActivatedUserCardProps) => {
    const {isBetween5PercerntAnd10PercentPurchasedSeats, isOver10PercerntPurchasedSeats} = calculateOverageUserActivated({seatsPurchased, activeUsers: activatedUsers || 0});
    const showOverageWarning = !isCloud && (isBetween5PercerntAnd10PercentPurchasedSeats || isOver10PercerntPurchasedSeats);

    let activeUserStatus: 'warning' | 'error' | undefined;
    if (!isCloud && isBetween5PercerntAnd10PercentPurchasedSeats) {
        activeUserStatus = 'warning';
    }

    if (!isCloud && isOver10PercerntPurchasedSeats) {
        activeUserStatus = 'error';
    }

    return (
        <StatisticCount
            title={<Title/>}
            icon='fa-users'
            status={activeUserStatus}
            count={activatedUsers}
            id='totalActiveUsers'
        >
            {showOverageWarning &&
            <div
                className={classNames({
                    team_statistics__message: true,
                    'team_statistics--warning': isBetween5PercerntAnd10PercentPurchasedSeats,
                    'team_statistics--error': isOver10PercerntPurchasedSeats,
                })}
            >
                <AlertOutlineIcon
                    size={14}
                />
                <FormattedMessage
                    id='analytics.team.overageUsersSeats'
                    defaultMessage='This exceeds total licensed seats'
                >
                    {(text) => <span>{text}</span>}
                </FormattedMessage>
            </div>}
        </StatisticCount>
    );
};

export default ActivatedUserCard;

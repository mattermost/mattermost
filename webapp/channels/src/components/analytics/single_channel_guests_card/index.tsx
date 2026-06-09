// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';

import {AlertOutlineIcon, InformationOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import StatisticCount from 'components/analytics/statistic_count';

export const messages = defineMessages({
    singleChannelGuests: {id: 'analytics.system.singleChannelGuests', defaultMessage: 'Single-channel Guests'},
});

type TitleProps = {
    isOverLimit: boolean;
}

const Title = ({isOverLimit}: TitleProps) => {
    const intl = useIntl();
    const text = intl.formatMessage(messages.singleChannelGuests);

    if (!isOverLimit) {
        return (
            <WithTooltip
                title={defineMessage({id: 'analytics.system.singleChannelGuests.info.tooltip.title', defaultMessage: 'Single-channel guests'})}
                hint={defineMessage({id: 'analytics.system.singleChannelGuests.info.tooltip.hint', defaultMessage: 'Guests that are only in one channel are not counted towards your total activated user count.'})}
            >
                <span className='single-channel-guest-title'>
                    {text}
                    <InformationOutlineIcon size={14}/>
                </span>
            </WithTooltip>
        );
    }

    return (
        <WithTooltip
            title={defineMessage({id: 'analytics.system.singleChannelGuests.tooltip.title', defaultMessage: 'Limit reached for single-channel guests'})}
            hint={defineMessage({id: 'analytics.system.singleChannelGuests.tooltip.hint', defaultMessage: 'The number of single-channel guests cannot exceed the total number of licensed seats'})}
            className='single-channel-guest-tooltip'
        >
            <span className='single-channel-guest-title'>
                {text}
                <AlertOutlineIcon size={14}/>
            </span>
        </WithTooltip>
    );
};

type SingleChannelGuestsCardProps = {
    singleChannelGuestsCount: number | undefined;
    singleChannelGuestLimit: number;
}

const SingleChannelGuestsCard = ({singleChannelGuestsCount, singleChannelGuestLimit}: SingleChannelGuestsCardProps) => {
    const isOverLimit = singleChannelGuestsCount !== undefined && singleChannelGuestLimit > 0 && singleChannelGuestsCount > singleChannelGuestLimit;

    return (
        <StatisticCount
            title={<Title isOverLimit={isOverLimit}/>}
            icon='fa-users'
            status={isOverLimit ? 'error' : undefined}
            count={singleChannelGuestsCount}
            id='singleChannelGuests'
        />
    );
};

export default SingleChannelGuestsCard;

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import type {FormatDateOptions} from 'react-intl';
import {useSelector} from 'react-redux';

import {EyeOffOutlineIcon} from '@mattermost/compass-icons/components';
import type {GlobalState} from '@mattermost/types/store';

import {getOldestPostTimeInChannel} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import useGetServerLimits from 'components/common/hooks/useGetServerLimits';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import './index.scss';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
const ONE_YEAR_MS = ONE_DAY_MS * 365;

interface Props {
    channelId?: string;
    firstInaccessiblePostTime?: number;
}

// returns the same time on the next day.
function getNextDay(timestamp?: number): number {
    if (timestamp === undefined) {
        return 0;
    }

    return timestamp + ONE_DAY_MS;
}

export default function CenterMessageLock(props: Props) {
    const intl = useIntl();

    const {openPricingModal} = useOpenPricingModal();

    const [serverLimits, limitsLoaded] = useGetServerLimits();
    const currentTeam = useSelector(getCurrentTeam);

    // firstInaccessiblePostTime is the most recently inaccessible post's created at date.
    // It is used as a backup for when there are no available posts in the channel;
    // The message then shows that the user can retrieve messages prior to the day
    // **after** the most recent day with inaccessible posts.
    const oldestPostTime = useSelector((state: GlobalState) => getOldestPostTimeInChannel(state, props.channelId || '')) || getNextDay(props.firstInaccessiblePostTime);

    if (!limitsLoaded) {
        return null;
    }

    const dateFormat: FormatDateOptions = {month: 'long', day: 'numeric'};
    if (Date.now() - oldestPostTime >= ONE_YEAR_MS) {
        dateFormat.year = 'numeric';
    }
    const titleValues = {
        date: intl.formatDate(oldestPostTime, dateFormat),
        team: currentTeam?.display_name,
    };

    const limit = intl.formatNumber(serverLimits?.postHistoryLimit || 0);

    const title = intl.formatMessage({
        id: 'workspace_limits.message_history.locked.title.admin',
        defaultMessage: 'Unlock messages prior to {date} in {team}',
    }, titleValues);

    const description = intl.formatMessage(
        {
            id: 'workspace_limits.message_history.locked.description.admin',
            defaultMessage: 'To view and search all of the messages in your workspace\'s history, rather than just the most recent {limit} messages, upgrade to one of our paid plans. <a>Review our plan options and pricing.</a>',
        },
        {
            limit,
            a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                <a
                    href='#'
                    onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        openPricingModal({trackingLocation: 'center_channel_posts_over_limit_banner'});
                    }}
                >
                    {chunks}
                </a>
            ),
        },
    );

    return (<div className='CenterMessageLock'>
        <div className='CenterMessageLock__left'>
            <EyeOffOutlineIcon color={'rgba(var(--center-channel-color-rgb), 0.75)'}/>
        </div>
        <div className='CenterMessageLock__right'>
            <div className='CenterMessageLock__title'>
                {title}
            </div>
            <div className='CenterMessageLock__description'>
                {description}
            </div>
        </div>
    </div>);
}

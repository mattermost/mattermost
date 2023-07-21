// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LeastActiveChannel} from '@mattermost/types/insights';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import Timestamp from 'components/timestamp';
import Avatars from 'components/widgets/users/avatars';

import ChannelActionsMenu from '../channel_actions_menu/channel_actions_menu';
import Constants from 'utils/constants';

import './../../../activity_and_insights.scss';

type Props = {
    channel: LeastActiveChannel;
    actionCallback: () => Promise<void>;
}

const LeastActiveChannelsItem = ({channel, actionCallback}: Props) => {
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const trackClickEvent = useCallback(() => {
        trackEvent('insights', 'open_channel_from_least_active_channels_widget');
    }, []);

    const iconToDisplay = useCallback(() => {
        let iconToDisplay = <i className='icon icon-globe'/>;

        if (channel.type === Constants.PRIVATE_CHANNEL) {
            iconToDisplay = <i className='icon icon-lock-outline'/>;
        }
        return iconToDisplay;
    }, [channel]);

    let timeMessage = (
        <FormattedMessage
            id='insights.leastActiveChannels.lastActivity'
            defaultMessage='Last activity: {time}'
            values={{
                time:
                (
                    <Timestamp
                        value={channel.last_activity_at}
                        units={[
                            'now',
                            'minute',
                            'hour',
                            'day',
                            'week',
                            'month',
                        ]}
                        useTime={false}
                    />
                ),
            }}
        />
    );
    if (channel.last_activity_at === 0) {
        timeMessage = (
            <FormattedMessage
                id='insights.leastActiveChannels.lastActivityNone'
                defaultMessage='No activity'
            />
        );
    }
    return (
        <Link
            className='channel-row'
            onClick={trackClickEvent}
            to={`${currentTeamUrl}/channels/${channel.name}`}
        >
            <div className='channel-info'>
                <div className='channel-display-name'>
                    <span className='icon'>
                        {iconToDisplay()}
                    </span>
                    <span className='display-name'>{channel.display_name}</span>
                </div>
                <span className='last-activity'>
                    {timeMessage}
                </span>
            </div>
            <Avatars
                userIds={channel.participants}
                size='xs'
                disableProfileOverlay={true}
            />
            <ChannelActionsMenu
                channel={channel}
                actionCallback={actionCallback}
            />
        </Link>
    );
};

export default memo(LeastActiveChannelsItem);

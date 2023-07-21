// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TopDM} from '@mattermost/types/insights';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import Avatar from 'components/widgets/users/avatar';

import Constants from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import './../../../activity_and_insights.scss';

type Props = {
    dm: TopDM;
    barSize: number;
    team: Team;
}

const TopDMsItem = ({dm, barSize, team}: Props) => {
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);

    const tooltip = useCallback((messageCount: number) => {
        return (
            <Tooltip
                id='total-messages'
            >
                <FormattedMessage
                    id='insights.topChannels.messageCount'
                    defaultMessage='{messageCount} total messages'
                    values={{
                        messageCount,
                    }}
                />
            </Tooltip>
        );
    }, []);

    const trackClick = useCallback(() => {
        trackEvent('insights', 'open_dm_from_top_dms_widget');
    }, []);

    return (
        <Link
            className='top-dms-item'
            to={`/${team.name}/messages/@${dm.second_participant.username}`}
            onClick={trackClick}
        >
            <Avatar
                url={imageURLForUser(dm.second_participant.id, dm.second_participant.last_picture_update)}
                size={'xl'}
            />
            <div className='dm-info'>
                <div
                    className='dm-name'
                >
                    {displayUsername(dm.second_participant as UserProfile, teammateNameDisplaySetting)}
                </div>
                <span className='dm-role'>{dm.second_participant.position}</span>
                <div className='channel-message-count'>
                    <OverlayTrigger
                        trigger={['hover']}
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='top'
                        overlay={tooltip(dm.post_count)}
                    >
                        <span className='message-count'>{dm.post_count}</span>
                    </OverlayTrigger>
                    <span
                        className='horizontal-bar'
                        style={{
                            flex: `${barSize} 0`,
                        }}
                    />
                </div>
            </div>

        </Link>
    );
};

export default memo(TopDMsItem);

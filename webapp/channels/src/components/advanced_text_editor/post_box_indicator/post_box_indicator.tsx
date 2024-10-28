// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {getDirectChannel} from 'mattermost-redux/selectors/entities/channels';
import {isScheduledPostsEnabled} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getTimezoneForUserProfile} from 'mattermost-redux/selectors/entities/timezone';
import {getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import RemoteUserHour from 'components/advanced_text_editor/remote_user_hour';
import ScheduledPostIndicator from 'components/advanced_text_editor/scheduled_post_indicator/scheduled_post_indicator';

import Constants, {UserStatuses} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './style.scss';

const DEFAULT_TIMEZONE = {
    useAutomaticTimezone: true,
    automaticTimezone: '',
    manualTimezone: '',
};

type Props = {
    channelId: string;
    teammateDisplayName: string;
    location: string;
    postId: string;
}

export default function PostBoxIndicator({channelId, teammateDisplayName, location, postId}: Props) {
    const teammateId = useSelector((state: GlobalState) => getDirectChannel(state, channelId)?.teammate_id || '');
    const isTeammateDND = useSelector((state: GlobalState) => (teammateId ? getStatusForUserId(state, teammateId) === UserStatuses.DND : false));
    const isDM = useSelector((state: GlobalState) => Boolean(getDirectChannel(state, channelId)?.teammate_id));
    const showDndWarning = isTeammateDND && isDM;

    const [timestamp, setTimestamp] = useState(0);
    const [showIt, setShowIt] = useState(false);

    const teammateTimezone = useSelector((state: GlobalState) => {
        const teammate = teammateId ? getUser(state, teammateId) : undefined;
        return teammate ? getTimezoneForUserProfile(teammate) : DEFAULT_TIMEZONE;
    }, (a, b) => a.automaticTimezone === b.automaticTimezone &&
        a.manualTimezone === b.manualTimezone &&
        a.useAutomaticTimezone === b.useAutomaticTimezone);

    useEffect(() => {
        const teammateUserDate = DateTime.local().setZone(teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone);
        setTimestamp(teammateUserDate.toMillis());
        setShowIt(teammateUserDate.get('hour') >= Constants.REMOTE_USERS_HOUR_LIMIT_END_OF_THE_DAY || teammateUserDate.get('hour') < Constants.REMOTE_USERS_HOUR_LIMIT_BEGINNING_OF_THE_DAY);

        const interval = setInterval(() => {
            const teammateUserDate = DateTime.local().setZone(teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone);
            setTimestamp(teammateUserDate.toMillis());
            setShowIt(teammateUserDate.get('hour') >= Constants.REMOTE_USERS_HOUR_LIMIT_END_OF_THE_DAY || teammateUserDate.get('hour') < Constants.REMOTE_USERS_HOUR_LIMIT_BEGINNING_OF_THE_DAY);
        }, 1000 * 60);
        return () => clearInterval(interval);
    }, [teammateTimezone.useAutomaticTimezone, teammateTimezone.automaticTimezone, teammateTimezone.manualTimezone]);

    const isScheduledPostEnabled = useSelector(isScheduledPostsEnabled);

    const showRemoteUserHour = showDndWarning && showIt && timestamp !== 0;

    return (
        <div className='postBoxIndicator'>
            {
                showRemoteUserHour &&
                <RemoteUserHour
                    displayName={teammateDisplayName}
                    timestamp={timestamp}
                    teammateTimezone={teammateTimezone}
                />
            }

            {

                isScheduledPostEnabled &&
                <ScheduledPostIndicator
                    location={location}
                    channelId={channelId}
                    postId={postId}
                    remoteUserHourDisplayed={showRemoteUserHour}
                />
            }
        </div>
    );
}

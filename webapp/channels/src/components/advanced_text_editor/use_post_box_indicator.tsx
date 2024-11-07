// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import {useState, useEffect, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getDirectChannel} from 'mattermost-redux/selectors/entities/channels';
import {isScheduledPostsEnabled} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getTimezoneForUserProfile, getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getStatusForUserId, getUser, makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import Constants, {UserStatuses} from 'utils/constants';

import type {GlobalState} from 'types/store';

const DEFAULT_TIMEZONE = {
    useAutomaticTimezone: true,
    automaticTimezone: 'UTC',
    manualTimezone: '',
};

const MINUTE = 1000 * 60;

function useTimePostBoxIndicator(channelId: string) {
    const getDisplayName = useMemo(makeGetDisplayName, []);

    const teammateId = useSelector((state: GlobalState) => getDirectChannel(state, channelId)?.teammate_id || '');
    const teammateDisplayName = useSelector((state: GlobalState) => (teammateId ? getDisplayName(state, teammateId) : ''));

    const isDM = useSelector(
        (state: GlobalState) => Boolean(getDirectChannel(state, channelId)?.teammate_id),
    );

    // Check if the teammate is in DND status
    const isTeammateDND = useSelector((state: GlobalState) =>
        (teammateId ? getStatusForUserId(state, teammateId) === UserStatuses.DND : false),
    );

    // Determine if the DND warning should be shown
    const showDndWarning = isTeammateDND && isDM;

    const [timestamp, setTimestamp] = useState(0);
    const [showIt, setShowIt] = useState(false);

    // get teammate timezone information
    const teammateTimezone = useSelector(
        (state: GlobalState) => {
            if (!teammateId) {
                return DEFAULT_TIMEZONE;
            }

            const teammate = getUser(state, teammateId);
            return getTimezoneForUserProfile(teammate);
        },
        (a, b) =>
            a.automaticTimezone === b.automaticTimezone &&
            a.manualTimezone === b.manualTimezone &&
            a.useAutomaticTimezone === b.useAutomaticTimezone,
    );

    // current user timezone
    const userCurrentTimezone = useSelector((state: GlobalState) => getCurrentTimezone(state));

    // UseEffect to update the timestamp and the visibility for the time indicator
    useEffect(() => {
        function updateTime() {
            const timezone =
                teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone || 'UTC';

            const teammateUserDate = DateTime.local().setZone(timezone);

            setTimestamp(teammateUserDate.toMillis());

            const currentHour = teammateUserDate.hour;
            const showIndicator =
                currentHour >= Constants.REMOTE_USERS_HOUR_LIMIT_END_OF_THE_DAY ||
                currentHour < Constants.REMOTE_USERS_HOUR_LIMIT_BEGINNING_OF_THE_DAY;

            setShowIt(showIndicator);
        }

        updateTime();

        const interval = setInterval(updateTime, MINUTE);

        return () => clearInterval(interval);
    }, [
        teammateTimezone.useAutomaticTimezone,
        teammateTimezone.automaticTimezone,
        teammateTimezone.manualTimezone,
    ]);

    const isScheduledPostEnabledValue = useSelector(isScheduledPostsEnabled);

    const showRemoteUserHour = isDM && showIt && timestamp !== 0;

    return {
        showRemoteUserHour,
        isDM,
        currentUserTimesStamp: timestamp,
        teammateTimezone,
        userCurrentTimezone,
        isScheduledPostEnabled: isScheduledPostEnabledValue,
        showDndWarning,
        teammateId,
        teammateDisplayName,
    };
}

export default useTimePostBoxIndicator;

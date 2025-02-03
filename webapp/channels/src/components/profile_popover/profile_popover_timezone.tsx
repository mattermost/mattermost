// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime, Duration} from 'luxon';
import React from 'react';
import {useIntl} from 'react-intl';

import type {UserTimezone} from '@mattermost/types/users';

import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import Timestamp from 'components/timestamp';

type ProfileTimezoneProps = {
    profileUserTimezone?: UserTimezone;
    currentUserTimezone: string | undefined;
    haveOverrideProp: boolean;
}

const TimeZoneDifference = ({
    currentUserTimezone,
    profileUserTimezone,
}: {
    currentUserTimezone: string | undefined | null;
    profileUserTimezone: string;
},
) => {
    const {formatMessage} = useIntl();

    if (!currentUserTimezone) {
        return null;
    }
    const currentUserDate = DateTime.local().setZone(currentUserTimezone);
    const profileUserDate = DateTime.local().setZone(profileUserTimezone);

    const offset = Duration.fromObject({
        hours: (profileUserDate.offset - currentUserDate.offset) / 60,
    });

    if (!offset.valueOf()) {
        return null;
    }

    const timeOffset = offset.toHuman({unitDisplay: 'short', signDisplay: 'never'});

    return offset.valueOf() > 0 ? (
        <>
            {formatMessage(
                {
                    id: 'user_profile.account.hoursAhead',
                    defaultMessage: '({timeOffset} ahead)',
                },
                {timeOffset},
            )}
        </>
    ) : (
        <>
            {
                formatMessage(
                    {
                        id: 'user_profile.account.hoursBehind',
                        defaultMessage: '({timeOffset} behind)',
                    },
                    {timeOffset},
                )
            }
        </>
    );
};

const ProfileTimezone = ({
    currentUserTimezone,
    profileUserTimezone,
    haveOverrideProp,
}: ProfileTimezoneProps) => {
    const {formatMessage} = useIntl();

    if (haveOverrideProp || !profileUserTimezone) {
        return null;
    }

    const profileTimezone = getUserCurrentTimezone(profileUserTimezone) || 'UTC';
    const profileTimezoneShort = profileTimezone ? DateTime.now().setZone(profileTimezone).offsetNameShort : undefined;

    return (
        <div
            className='user-popover__time-status-container'
        >
            <strong
                id='user-popover__timezone-title'
                className='user-popover__subtitle'
            >
                {profileTimezoneShort ? formatMessage(
                    {
                        id: 'user_profile.account.localTimeWithTimezone',
                        defaultMessage: 'Local Time ({timezone})',
                    },
                    {
                        timezone: profileTimezoneShort,
                    },
                ) : formatMessage({
                    id: 'user_profile.account.localTime',
                    defaultMessage: 'Local Time',
                })}
            </strong>
            <p
                aria-labelledby='user-popover__timezone-title'
                className='user-popover__subtitle-text'
            >
                <Timestamp
                    useRelative={false}
                    useDate={false}
                    userTimezone={profileUserTimezone}
                    useTime={{
                        hour: 'numeric',
                        minute: 'numeric',
                    }}
                />
                {' '}
                <TimeZoneDifference
                    currentUserTimezone={currentUserTimezone}
                    profileUserTimezone={profileTimezone}
                />
            </p>
        </div>
    );
};

export default ProfileTimezone;

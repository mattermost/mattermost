// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime, Duration} from 'luxon';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {UserTimezone} from '@mattermost/types/users';

import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import Timestamp from 'components/timestamp';

type ProfileTimezoneProps = {
    profileUserTimezone?: UserTimezone;
    currentUserTimezone: string | undefined;
    haveOverrideProp: boolean;
}

const returnTimeDiff = (
    currentUserTimezone: string | undefined | null,
    profileUserTimezone: string,
) => {
    if (!currentUserTimezone) {
        return null;
    }
    const currentUserDate = DateTime.local().setZone(currentUserTimezone);
    const profileUserDate = DateTime.local().setZone(profileUserTimezone);

    const offset = Duration.fromObject({
        hours: (profileUserDate.offset - currentUserDate.offset) / 60,
    });

    if (!offset.valueOf()) {
        return undefined;
    }

    const timeOffset = offset.toHuman({unitDisplay: 'short', signDisplay: 'never'});

    return offset.valueOf() > 0 ? (
        <FormattedMessage
            id='user_profile.account.hoursAhead'
            defaultMessage='({timeOffset} ahead)'
            values={{timeOffset}}
        />
    ) : (
        <FormattedMessage
            id='user_profile.account.hoursBehind'
            defaultMessage='({timeOffset} behind)'
            values={{timeOffset}}
        />
    );
};

const ProfileTimezone = ({
    currentUserTimezone,
    profileUserTimezone,
    haveOverrideProp,
}: ProfileTimezoneProps) => {
    if (haveOverrideProp || !profileUserTimezone) {
        return null;
    }

    const profileTimezone = getUserCurrentTimezone(profileUserTimezone) || 'UTC';
    const profileTimezoneShort = profileTimezone ? DateTime.now().setZone(profileTimezone).offsetNameShort : undefined;

    return (
        <div
            className='user-popover__time-status-container'
        >
            <span className='user-popover__subtitle'>
                {profileTimezoneShort ? (
                    <FormattedMessage
                        id='user_profile.account.localTimeWithTimezone'
                        defaultMessage='Local Time ({timezone})'
                        values={{
                            timezone: profileTimezoneShort,
                        }}
                    />
                ) : (
                    <FormattedMessage
                        id='user_profile.account.localTime'
                        defaultMessage='Local Time'
                    />
                )}

            </span>
            <span>
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
                {returnTimeDiff(currentUserTimezone, profileTimezone)}
            </span>

        </div>
    );
};

export default ProfileTimezone;

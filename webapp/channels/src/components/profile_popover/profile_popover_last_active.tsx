// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {displayLastActiveLabel, getLastActiveTimestampUnits, getLastActivityForUserId} from 'mattermost-redux/selectors/entities/users';

import Timestamp from 'components/timestamp';

import type {GlobalState} from 'types/store';

type Props = {
    userId: string;
}
const ProfilePopoverLastActive = ({
    userId,
}: Props) => {
    const lastActivityTimestamp = useSelector((state: GlobalState) => getLastActivityForUserId(state, userId));
    const enableLastActiveTime = useSelector<GlobalState>((state) => displayLastActiveLabel(state, userId));
    const timestampUnits = useSelector((state: GlobalState) => getLastActiveTimestampUnits(state, userId));

    if (!enableLastActiveTime) {
        return null;
    }

    return (
        <div className='user-popover-last-active'>
            <FormattedMessage
                id='channel_header.lastOnline'
                defaultMessage='Last online {timestamp}'
                values={{
                    timestamp: (
                        <Timestamp
                            value={lastActivityTimestamp}
                            units={timestampUnits}
                            useTime={false}
                            style={'short'}
                        />
                    ),
                }}
            />
        </div>
    );
};

export default ProfilePopoverLastActive;

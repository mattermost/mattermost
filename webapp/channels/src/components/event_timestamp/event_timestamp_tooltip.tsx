// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {connect} from 'react-redux';

import {getUseMilitaryTime} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {formatFullDateTimeForTooltip} from 'utils/datetime_display_format';

import type {GlobalState} from 'types/store';

type Props = {
    value: number | Date;
    timeZone?: string;
    useMilitaryTime: boolean;
};

function EventTimestampTooltip({value, timeZone, useMilitaryTime}: Props) {
    const intl = useIntl();
    const dateValue = value instanceof Date ? value : new Date(value);

    return (
        <>
            {formatFullDateTimeForTooltip(dateValue, intl, {timeZone, useMilitaryTime})}
        </>
    );
}

function mapStateToProps(state: GlobalState) {
    const userTimezone = getCurrentTimezoneFull(state);
    const timeZone = getUserCurrentTimezone(userTimezone) || undefined;

    return {timeZone, useMilitaryTime: getUseMilitaryTime(state)};
}

export default connect(mapStateToProps)(EventTimestampTooltip);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {connect} from 'react-redux';

import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {Preferences} from 'utils/constants';
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
    const useMilitaryTime = getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false);

    return {timeZone, useMilitaryTime};
}

export default connect(mapStateToProps)(EventTimestampTooltip);

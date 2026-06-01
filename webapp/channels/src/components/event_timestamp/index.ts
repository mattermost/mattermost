// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getBool, getDateTimeDisplayFormat} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import EventTimestamp from './event_timestamp';

function mapStateToProps(state: GlobalState) {
    const userTimezone = getCurrentTimezoneFull(state);
    const timeZone = getUserCurrentTimezone(userTimezone) || undefined;
    const useMilitaryTime = getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false);

    return {
        dateTimeDisplayFormat: getDateTimeDisplayFormat(state),
        timeZone,
        useMilitaryTime,
    };
}

export default connect(mapStateToProps)(EventTimestamp);

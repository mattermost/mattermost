// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {
    getShowTimestampSeconds,
    getTimestampFormat,
    getUseMilitaryTime,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import type {GlobalState} from 'types/store';

import EventTimestamp from './event_timestamp';

function mapStateToProps(state: GlobalState) {
    const userTimezone = getCurrentTimezoneFull(state);
    const timeZone = getUserCurrentTimezone(userTimezone) || undefined;

    return {
        timestampFormat: getTimestampFormat(state),
        showTimestampSeconds: getShowTimestampSeconds(state),
        timeZone,
        useMilitaryTime: getUseMilitaryTime(state),
    };
}

export default connect(mapStateToProps)(EventTimestamp);

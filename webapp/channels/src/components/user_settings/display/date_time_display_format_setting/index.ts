// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {TimestampFormat} from '@mattermost/types/config';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import DateTimeDisplayFormatSetting, {isDateAndTimeSectionActive} from './date_time_display_format_setting';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        configTimestampFormat: (config.DefaultTimestampFormat as TimestampFormat) || TimestampFormat.STANDARD,
        configShowTimestampSeconds: config.ShowTimestampSeconds === 'true',
        militaryTime: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, Preferences.USE_MILITARY_TIME_DEFAULT),
        showTimestampSeconds: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.SHOW_TIMESTAMP_SECONDS, 'false'),
    };
}

export {isDateAndTimeSectionActive};
export default connect(mapStateToProps)(DateTimeDisplayFormatSetting);

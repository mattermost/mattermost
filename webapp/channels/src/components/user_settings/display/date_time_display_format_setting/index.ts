// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {TimestampFormat} from '@mattermost/types/config';
import type {PreferencesType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    getFromPreferences,
    getMyPreferences,
    getShowTimestampSecondsSettingFromPreferences,
    getTimestampFormatFromPreferences,
} from 'mattermost-redux/selectors/entities/preferences';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import DateTimeDisplayFormatSetting, {isDateAndTimeSectionActive} from './date_time_display_format_setting';

type OwnProps = {
    user: UserProfile;
    adminMode?: boolean;
    userPreferences?: PreferencesType;
    active: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section?: string) => void;
};

export function getMapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);

    // In admin mode (System Console > Manage User Settings) show and edit the target user's preferences
    const preferences = ownProps.adminMode && ownProps.userPreferences ? ownProps.userPreferences : getMyPreferences(state);

    return {
        configTimestampFormat: (config.DateTimeDisplayFormat as TimestampFormat) || TimestampFormat.STANDARD,
        configShowTimestampSeconds: config.ShowTimestampSeconds === 'true',
        timestampFormat: getTimestampFormatFromPreferences(preferences, config),
        militaryTime: getFromPreferences(preferences, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, Preferences.USE_MILITARY_TIME_DEFAULT),
        showTimestampSeconds: getShowTimestampSecondsSettingFromPreferences(preferences, config) ? 'true' : 'false',
    };
}

export {isDateAndTimeSectionActive};
export default connect(getMapStateToProps)(DateTimeDisplayFormatSetting);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Settings} from 'luxon';

import {getCurrentLocale} from 'selectors/i18n';
import {areTimezonesEnabledAndSupported} from 'selectors/general';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {makeGetUserTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {GlobalState} from 'types/store';

let prevTimezone: string | undefined;
let prevLocale: string | undefined;
export function applyLuxonDefaults(state: GlobalState) {
    const locale = getCurrentLocale(state);
    if (locale !== prevLocale) {
        prevLocale = locale;
        Settings.defaultLocale = locale;
    }

    if (areTimezonesEnabledAndSupported(state)) {
        const tz = getUserCurrentTimezone(makeGetUserTimezone()(state, getCurrentUserId(state))) ?? undefined;
        if (tz !== prevTimezone) {
            prevTimezone = tz;
            Settings.defaultZone = tz ?? 'system';
        }
    }
}

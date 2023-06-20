// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'types/store';
import {suitePluginIds} from 'utils/constants';
import semver from 'semver';

export function isCallsEnabled(state: GlobalState, minVersion = '0.4.2') {
    return state.plugins.plugins[suitePluginIds.calls] &&
        semver.gte(state.plugins.plugins[suitePluginIds.calls].version || '0.0.0', minVersion);
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getServerLimits} from 'mattermost-redux/selectors/entities/limits';

import type {GlobalState} from 'types/store';

import SystemAnalytics from './system_analytics';

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const isLicensed = license.IsLicensed === 'true';

    return {
        isLicensed,
        license,
        stats: state.entities.admin.analytics,
        config: getConfig(state),
        pluginStatHandlers: state.plugins.siteStatsHandlers,
        serverLimits: getServerLimits(state),
    };
}

export default connect(mapStateToProps)(SystemAnalytics);

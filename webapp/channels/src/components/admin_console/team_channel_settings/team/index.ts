// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {GlobalState} from '@mattermost/types/store';

import {TeamsSettings} from './team_settings';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const siteName = config.SiteName as string;

    return {
        siteName,
    };
}

export default connect(mapStateToProps)(TeamsSettings);

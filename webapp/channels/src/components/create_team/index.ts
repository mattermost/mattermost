// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {isAnonymousURLEnabled} from 'selectors/config';

import type {GlobalState} from 'types/store';

import CreateTeam from './create_team';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentChannel = getCurrentChannel(state);
    const currentTeam = getCurrentTeam(state);

    const customDescriptionText = config.CustomDescriptionText;
    const siteName = config.SiteName;

    const useAnonymousURLs = isAnonymousURLEnabled(state);

    return {
        currentChannel,
        currentTeam,
        customDescriptionText,
        siteName,
        useAnonymousURLs,
    };
}

export default connect(mapStateToProps)(CreateTeam);

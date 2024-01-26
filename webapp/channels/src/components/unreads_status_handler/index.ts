// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import {connect} from 'react-redux';
import {withRouter, matchPath} from 'react-router-dom';
import type {RouteChildrenProps} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentChannel, getUnreadStatus} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import UnreadsStatusHandler from './unreads_status_handler';

type Props = RouteChildrenProps;

function mapStateToProps(state: GlobalState, {location: {pathname}}: Props): ComponentProps<typeof UnreadsStatusHandler> {
    const config = getConfig(state);
    const currentChannel = getCurrentChannel(state);
    const currentTeammate = (currentChannel && currentChannel.teammate_id) ? currentChannel : null;
    const currentTeam = getCurrentTeam(state);

    return {
        currentChannel,
        currentTeam,
        currentTeammate,
        siteName: config.SiteName,
        unreadStatus: getUnreadStatus(state),
        inGlobalThreads: matchPath(pathname, {path: '/:team/threads/:threadIdentifier?'}) != null,
        inDrafts: matchPath(pathname, {path: '/:team/drafts'}) != null,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
        }, dispatch),
    };
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(UnreadsStatusHandler));

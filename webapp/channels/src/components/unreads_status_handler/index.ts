// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {withRouter, matchPath} from 'react-router-dom';
import type {RouteChildrenProps} from 'react-router-dom';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentChannel, getDirectTeammateId, getUnreadStatus} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import UnreadsStatusHandler from './unreads_status_handler';

type Props = RouteChildrenProps;

function makeMapStateToProps() {
    const getDisplayName = makeGetDisplayName();

    return function mapStateToProps(state: GlobalState, {location: {pathname}}: Props) {
        const config = getConfig(state);
        const currentChannel = getCurrentChannel(state);
        const currentTeammateId = currentChannel ? getDirectTeammateId(state, currentChannel.id) : '';
        const currentTeammateName = currentTeammateId ? getDisplayName(state, currentTeammateId, false) : '';
        const currentTeam = getCurrentTeam(state);

        return {
            currentChannel,
            currentTeam,
            currentTeammateName,
            siteName: config.SiteName,
            unreadStatus: getUnreadStatus(state),
            inGlobalThreads: matchPath(pathname, {path: '/:team/threads/:threadIdentifier?'}) != null,
            inDrafts: matchPath(pathname, {path: '/:team/drafts'}) != null,
            inScheduledPosts: matchPath(pathname, {path: '/:team/scheduled_posts'}) != null,
        };
    };
}

export default withRouter(connect(makeMapStateToProps)(UnreadsStatusHandler));

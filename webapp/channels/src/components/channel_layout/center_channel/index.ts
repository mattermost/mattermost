// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';
import {RouteComponentProps, withRouter} from 'react-router-dom';

import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {getProfiles} from 'mattermost-redux/actions/users';
import {getTeamByName} from 'mattermost-redux/selectors/entities/teams';
import {getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {isCollapsedThreadsEnabled, insightsAreEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getIsMobileView} from 'selectors/views/browser';
import {getIsRhsOpen, getIsRhsMenuOpen} from 'selectors/rhs';
import {getIsLhsOpen} from 'selectors/lhs';
import {getLastViewedChannelNameByTeamName, getLastViewedTypeByTeamName, getPreviousTeamId, getPreviousTeamLastViewedType} from 'selectors/local_storage';

import {GlobalState} from 'types/store';

import {PreviousViewedTypes} from 'utils/constants';

import CenterChannel from './center_channel';

type Params = {
    team: string;
}

export type OwnProps = RouteComponentProps<Params>;

const mapStateToProps = (state: GlobalState, ownProps: OwnProps) => {
    const lastViewedType = getLastViewedTypeByTeamName(state, ownProps.match.params.team);
    let channelName = getLastViewedChannelNameByTeamName(state, ownProps.match.params.team);

    const previousTeamId = getPreviousTeamId(state);
    const team = getTeamByName(state, ownProps.match.params.team);

    let previousTeamLastViewedType;

    if (previousTeamId !== team?.id) {
        previousTeamLastViewedType = getPreviousTeamLastViewedType(state);
    }

    if (!channelName) {
        channelName = getRedirectChannelNameForTeam(state, team!.id);
    }

    let lastChannelPath;
    if (isCollapsedThreadsEnabled(state) && (previousTeamLastViewedType === PreviousViewedTypes.THREADS || lastViewedType === PreviousViewedTypes.THREADS)) {
        lastChannelPath = `${ownProps.match.url}/threads`;
    } else if (insightsAreEnabled(state) && lastViewedType === PreviousViewedTypes.INSIGHTS) {
        lastChannelPath = `${ownProps.match.url}/activity-and-insights`;
    } else {
        lastChannelPath = `${ownProps.match.url}/channels/${channelName}`;
    }

    return {
        lastChannelPath,
        lhsOpen: getIsLhsOpen(state),
        rhsOpen: getIsRhsOpen(state),
        rhsMenuOpen: getIsRhsMenuOpen(state),
        isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
        currentUserId: getCurrentUserId(state),
        insightsAreEnabled: insightsAreEnabled(state),
        isMobileView: getIsMobileView(state),
    };
};

type Actions = {
    getProfiles: (page?: number, perPage?: number, options?: Record<string, string | boolean>) => ActionFunc;
};

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            getProfiles,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default withRouter(connector(CenterChannel));


// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {getIsMobileView} from 'selectors/views/browser';

import PostTime from './post_time';

import type {GlobalState} from 'types/store';

type OwnProps = {
    teamName?: string;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        isMobileView: getIsMobileView(state),
        teamUrl: ownProps.teamName ? `/${ownProps.teamName}` : getCurrentRelativeTeamUrl(state),
    };
}

export default connect(mapStateToProps)(PostTime);

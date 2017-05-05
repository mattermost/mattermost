// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {viewChannel, getMyChannelMembers} from 'mattermost-redux/actions/channels';

import NeedsTeam from './needs_team.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            viewChannel,
            getMyChannelMembers
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(NeedsTeam);

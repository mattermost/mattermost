// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getProfilesNotInChannel} from 'mattermost-redux/actions/users';

import ChannelInviteModal from 'components/channel_invite_modal.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getProfilesNotInChannel
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelInviteModal);

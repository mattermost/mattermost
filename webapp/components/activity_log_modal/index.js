// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {revokeSession, getSessions} from 'mattermost-redux/actions/users';

import ActivityLogModal from './activity_log_modal.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getSessions,
            revokeSession
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ActivityLogModal);

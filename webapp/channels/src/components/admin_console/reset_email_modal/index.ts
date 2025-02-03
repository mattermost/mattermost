// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchUser} from 'mattermost-redux/actions/users';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import type {GlobalState} from 'types/store';

import ResetEmailModal from './reset_email_modal';

function mapStateToProps(state: GlobalState) {
    return {
        currentUserId: getCurrentUserId(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ResetEmailModal);

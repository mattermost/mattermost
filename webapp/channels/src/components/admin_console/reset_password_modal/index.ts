// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {updateUserPassword} from 'mattermost-redux/actions/users';
import {getPasswordConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import ResetPasswordModal from './reset_password_modal';

function mapStateToProps(state: GlobalState) {
    return {
        currentUserId: getCurrentUserId(state),
        passwordConfig: getPasswordConfig(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateUserPassword,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ResetPasswordModal);

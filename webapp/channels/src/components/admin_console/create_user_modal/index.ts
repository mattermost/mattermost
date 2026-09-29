// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {createUser} from 'mattermost-redux/actions/users';
import {getPasswordConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import CreateUserModal from './create_user_modal';

function mapStateToProps(state: GlobalState) {
    return {
        passwordConfig: getPasswordConfig(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            createUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(CreateUserModal);

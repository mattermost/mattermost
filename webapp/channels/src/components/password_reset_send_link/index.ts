// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {sendPasswordResetEmail} from 'mattermost-redux/actions/users';

import PasswordResetSendLink from './password_reset_send_link';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        sendPasswordResetEmail,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(PasswordResetSendLink);

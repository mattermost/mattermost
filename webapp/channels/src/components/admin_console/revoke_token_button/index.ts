// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {revokeUserAccessToken} from 'mattermost-redux/actions/users';

import RevokeTokenButton from './revoke_token_button';

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            revokeUserAccessToken,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(RevokeTokenButton);

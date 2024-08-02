// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {allowOAuth2, getOAuthAppInfo} from 'actions/admin_actions.jsx';

import Authorize from './authorize';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getOAuthAppInfo,
            allowOAuth2,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(Authorize);

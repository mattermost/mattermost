// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {updateConfig} from 'mattermost-redux/actions/admin';

import OpenIdConvert from './openid_convert';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateConfig,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(OpenIdConvert);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {
    updateConfig,
} from 'mattermost-redux/actions/admin';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import GlobalPolicyForm from './global_policy_form';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateConfig,
            setNavigationBlocked,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(GlobalPolicyForm);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {
    patchConfig,
} from 'mattermost-redux/actions/admin';
import {getEnvironmentConfig} from 'mattermost-redux/selectors/entities/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import type {GlobalState} from 'types/store';

import GlobalPolicyForm from './global_policy_form';

function mapStateToProps(state: GlobalState) {
    const messageRetentionHours = getConfig(state).DataRetentionMessageRetentionHours;
    const fileRetentionHours = getConfig(state).DataRetentionFileRetentionHours;

    return {
        messageRetentionHours,
        fileRetentionHours,
        environmentConfig: getEnvironmentConfig(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchConfig,
            setNavigationBlocked,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(GlobalPolicyForm);

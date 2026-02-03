// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getDataRetentionCustomPolicies as fetchDataRetentionCustomPolicies, deleteDataRetentionCustomPolicy, patchConfig} from 'mattermost-redux/actions/admin';
import {createJob, getJobsByType} from 'mattermost-redux/actions/jobs';
import {getDataRetentionCustomPolicies, getDataRetentionCustomPoliciesCount} from 'mattermost-redux/selectors/entities/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import DataRetentionSettings from './data_retention_settings';

function mapStateToProps(state: GlobalState) {
    const customPolicies = getDataRetentionCustomPolicies(state);
    const customPoliciesCount = getDataRetentionCustomPoliciesCount(state);
    const globalMessageRetentionHours = getConfig(state).DataRetentionMessageRetentionHours;
    const globalFileRetentionHours = getConfig(state).DataRetentionFileRetentionHours;

    return {
        customPolicies,
        customPoliciesCount,
        globalMessageRetentionHours,
        globalFileRetentionHours,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getDataRetentionCustomPolicies: fetchDataRetentionCustomPolicies,
            createJob,
            getJobsByType,
            deleteDataRetentionCustomPolicy,
            patchConfig,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DataRetentionSettings);

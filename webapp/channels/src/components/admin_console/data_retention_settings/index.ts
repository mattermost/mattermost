// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getDataRetentionCustomPolicies as fetchDataRetentionCustomPolicies, deleteDataRetentionCustomPolicy, updateConfig} from 'mattermost-redux/actions/admin';
import {createJob, getJobsByType} from 'mattermost-redux/actions/jobs';
import {getDataRetentionCustomPolicies, getDataRetentionCustomPoliciesCount} from 'mattermost-redux/selectors/entities/admin';

import DataRetentionSettings from './data_retention_settings';

import type {DataRetentionCustomPolicies} from '@mattermost/types/data_retention';
import type {JobTypeBase, JobType} from '@mattermost/types/jobs';
import type {GenericAction, ActionFunc, ActionResult} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {GlobalState} from 'types/store';

type Actions = {
    getDataRetentionCustomPolicies: () => Promise<{ data: DataRetentionCustomPolicies}>;
    deleteDataRetentionCustomPolicy: (id: string) => Promise<ActionResult>;
    createJob: (job: JobTypeBase) => Promise<{ data: any}>;
    getJobsByType: (job: JobType) => Promise<{ data: any}>;
    updateConfig: (config: Record<string, any>) => Promise<{ data: any}>;
};

function mapStateToProps(state: GlobalState) {
    const customPolicies = getDataRetentionCustomPolicies(state);
    const customPoliciesCount = getDataRetentionCustomPoliciesCount(state);

    return {
        customPolicies,
        customPoliciesCount,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getDataRetentionCustomPolicies: fetchDataRetentionCustomPolicies,
            createJob,
            getJobsByType,
            deleteDataRetentionCustomPolicy,
            updateConfig,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DataRetentionSettings);

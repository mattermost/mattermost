// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {
    getDataRetentionCustomPolicy as fetchPolicy,
    getDataRetentionCustomPolicyTeams as fetchPolicyTeams,
    createDataRetentionCustomPolicy,
    updateDataRetentionCustomPolicy,
    addDataRetentionCustomPolicyTeams,
    removeDataRetentionCustomPolicyTeams,
    addDataRetentionCustomPolicyChannels,
    removeDataRetentionCustomPolicyChannels,
} from 'mattermost-redux/actions/admin';
import {getDataRetentionCustomPolicy} from 'mattermost-redux/selectors/entities/admin';
import {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';
import {
    DataRetentionCustomPolicy,
    CreateDataRetentionCustomPolicy,
    PatchDataRetentionCustomPolicy,
} from '@mattermost/types/data_retention';
import {Team} from '@mattermost/types/teams';

import {GlobalState} from 'types/store';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import {getTeamsInPolicy} from 'mattermost-redux/selectors/entities/teams';

import CustomPolicyForm from './custom_policy_form';

type Actions = {
    fetchPolicy: (id: string) => Promise<{ data: DataRetentionCustomPolicy }>;
    fetchPolicyTeams: (id: string, page: number, perPage: number) => Promise<{ data: Team[] }>;
    createDataRetentionCustomPolicy: (policy: CreateDataRetentionCustomPolicy) => Promise<{ data: DataRetentionCustomPolicy }>;
    updateDataRetentionCustomPolicy: (id: string, policy: PatchDataRetentionCustomPolicy) => Promise<{ data: DataRetentionCustomPolicy }>;
    addDataRetentionCustomPolicyTeams: (id: string, teams: string[]) => Promise<{ data?: {status: string}; error?: Error }>;
    removeDataRetentionCustomPolicyTeams: (id: string, teams: string[]) => Promise<{ data?: {status: string}; error?: Error }>;
    addDataRetentionCustomPolicyChannels: (id: string, channels: string[]) => Promise<{ data?: {status: string}; error?: Error }>;
    removeDataRetentionCustomPolicyChannels: (id: string, channels: string[]) => Promise<{ data?: {status: string}; error?: Error }>;
    setNavigationBlocked: (blocked: boolean) => void;
};

type OwnProps = {
    match: {
        params: {
            policy_id: string;
        };
    };
}

function mapStateToProps() {
    const getPolicyTeams = getTeamsInPolicy();
    return (state: GlobalState, ownProps: OwnProps) => {
        const policyId = ownProps.match.params.policy_id;
        const policy = getDataRetentionCustomPolicy(state, policyId);
        const teams = policyId ? getPolicyTeams(state, {policyId}) : [];
        return {
            policyId,
            policy,
            teams,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            fetchPolicy,
            fetchPolicyTeams,
            createDataRetentionCustomPolicy,
            updateDataRetentionCustomPolicy,
            addDataRetentionCustomPolicyTeams,
            removeDataRetentionCustomPolicyTeams,
            addDataRetentionCustomPolicyChannels,
            removeDataRetentionCustomPolicyChannels,
            setNavigationBlocked,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(CustomPolicyForm);

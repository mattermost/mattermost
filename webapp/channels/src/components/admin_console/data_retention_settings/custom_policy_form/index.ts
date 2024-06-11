// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

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
import {getTeamsInPolicy} from 'mattermost-redux/selectors/entities/teams';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import type {GlobalState} from 'types/store';

import CustomPolicyForm from './custom_policy_form';

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

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
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

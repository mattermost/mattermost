// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {ServiceEnvironment} from '@mattermost/types/config';

import {getAccessControlPolicy as fetchPolicy, createAccessControlPolicy as createPolicy, deleteAccessControlPolicy as deletePolicy, searchAccessControlPolicyChannels as searchChannels, assignChannelsToAccessControlPolicy, unassignChannelsFromAccessControlPolicy, getAccessControlFields, updateAccessControlPolicyActive, getVisualAST} from 'mattermost-redux/actions/access_control';
import {createJob} from 'mattermost-redux/actions/jobs';
import {getAccessControlPolicy as getPolicy} from 'mattermost-redux/selectors/entities/access_control';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import type {GlobalState} from 'types/store';

import PolicyDetails from './policy_details';

type OwnProps = {
    match: {
        params: {
            policy_id: string;
        };
    };
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const policyId = ownProps.match.params.policy_id;
    const policy = getPolicy(state, policyId);
    const config = getConfig(state);
    return {
        policy,
        policyId,
        serviceEnvironment: config.ServiceEnvironment as ServiceEnvironment,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            fetchPolicy,
            createPolicy,
            deletePolicy,
            searchChannels,
            assignChannelsToAccessControlPolicy,
            unassignChannelsFromAccessControlPolicy,
            setNavigationBlocked,
            getAccessControlFields,
            createJob,
            updateAccessControlPolicyActive,
            getVisualAST,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PolicyDetails);

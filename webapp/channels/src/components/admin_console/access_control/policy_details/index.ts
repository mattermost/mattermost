// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import { getAccessControlPolicy as fetchPolicy } from 'mattermost-redux/actions/access_control';
import {getAccessControlPolicy} from 'mattermost-redux/selectors/entities/access_control';

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
    const policy = getAccessControlPolicy(state, policyId);
    // const channels = policyId ? getChildPolicies(state, {policyId}) : [];
    return {
        policyId,
        policy,
        // channels,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            fetchPolicy,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PolicyDetails);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {searchAccessControlPolicies, deleteAccessControlPolicy} from 'mattermost-redux/actions/access_control';

import PolicyList from './policies';
import { getHistory } from 'utils/browser_history';
import { AccessControlPolicy } from '@mattermost/types/admin';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    onPolicySelected: (policy: AccessControlPolicy) => {
        getHistory().push(`/admin_console/user_management/attribute_based_access_control/edit_policy/${policy.id}`);
    },
    actions: bindActionCreators({
        searchPolicies: searchAccessControlPolicies,
        deletePolicy: deleteAccessControlPolicy,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(PolicyList);

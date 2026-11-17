// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {
    searchSystemSettingPolicies,
    deleteAccessControlPolicy,
    getSystemSettingPolicyOrder,
    updateSystemSettingPolicyOrder,
} from 'mattermost-redux/actions/access_control';
import {getSystemSettingPolicyOrder as selectSystemSettingPolicyOrder} from 'mattermost-redux/selectors/entities/access_control';

import type {GlobalState} from 'types/store';

import ScopedConfigurationList from './scoped_configuration';

const mapStateToProps = (state: GlobalState) => ({
    order: selectSystemSettingPolicyOrder(state),
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        searchPolicies: (term: string, after: string, limit: number) => searchSystemSettingPolicies(term, after, limit),
        deletePolicy: deleteAccessControlPolicy,
        getPolicyOrder: getSystemSettingPolicyOrder,
        updatePolicyOrder: updateSystemSettingPolicyOrder,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ScopedConfigurationList);

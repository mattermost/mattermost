// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {searchSystemSettingPolicies, deleteAccessControlPolicy} from 'mattermost-redux/actions/access_control';

import ScopedConfigurationList from './scoped_configuration';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        searchPolicies: (term: string, after: string, limit: number) => searchSystemSettingPolicies(term, after, limit),
        deletePolicy: deleteAccessControlPolicy,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(ScopedConfigurationList);

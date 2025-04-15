// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import PolicyList from './policies';

import {searchAccessControlPolicies as searchPolicies} from 'mattermost-redux/actions/access_control';
import { bindActionCreators } from 'redux';
import type {Dispatch} from 'redux';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            searchPolicies: searchPolicies,
        }, dispatch),
    };
}


export default connect(null, mapDispatchToProps)(PolicyList);
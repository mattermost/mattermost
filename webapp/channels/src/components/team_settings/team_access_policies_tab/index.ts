// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {searchTeamAccessControlPolicies} from 'mattermost-redux/actions/access_control';

import TeamAccessPoliciesTab from './team_access_policies_tab';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        searchTeamPolicies: searchTeamAccessControlPolicies,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(TeamAccessPoliciesTab);

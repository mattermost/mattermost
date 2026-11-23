// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getHealthFindings, muteHealthFinding, unmuteHealthFinding} from 'mattermost-redux/actions/health';
import {createJob, getJobsByType} from 'mattermost-redux/actions/jobs';
import {Permissions} from 'mattermost-redux/constants';
import {getFindings, getLastEvaluatedAt, getMutedFindings} from 'mattermost-redux/selectors/entities/health';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import type {GlobalState} from 'types/store';

import HealthDashboard from './health_dashboard';

function mapStateToProps(state: GlobalState) {
    return {
        findings: getFindings(state),
        mutedFindings: getMutedFindings(state),
        lastEvaluatedAt: getLastEvaluatedAt(state),
        canManage: haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM}),
        jobs: state.entities.jobs.jobs,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getHealthFindings,
            muteHealthFinding,
            unmuteHealthFinding,
            createJob,
            getJobsByType,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(HealthDashboard);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getHealthFindings} from 'mattermost-redux/actions/health';
import {getFindings, getLastEvaluatedAt} from 'mattermost-redux/selectors/entities/health';

import type {GlobalState} from 'types/store';

import HealthDashboard from './health_dashboard';

function mapStateToProps(state: GlobalState) {
    return {
        findings: getFindings(state),
        lastEvaluatedAt: getLastEvaluatedAt(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getHealthFindings,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(HealthDashboard);

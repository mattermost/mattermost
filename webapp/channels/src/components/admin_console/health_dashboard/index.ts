// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getHealthFindings} from 'mattermost-redux/actions/health';
import {
    getFindingsByArea,
    getLastEvaluatedAt,
    getSeverityCounts,
    getUnknownFindings,
} from 'mattermost-redux/selectors/entities/health';

import type {GlobalState} from 'types/store';

import HealthDashboard from './health_dashboard';

function mapStateToProps(state: GlobalState) {
    return {
        findingsByArea: getFindingsByArea(state),
        unknownFindings: getUnknownFindings(state),
        severityCounts: getSeverityCounts(state),
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

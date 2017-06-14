// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getComplianceReports, createComplianceReport} from 'mattermost-redux/actions/admin';

import {getComplianceReports as selectComplianceReports, getConfig} from 'mattermost-redux/selectors/entities/admin';

import ComplianceReports from './compliance_reports.jsx';

function mapStateToProps(state, ownProps) {
    let enabled = false;
    const config = getConfig(state);
    if (config && config.ComplianceSettings) {
        enabled = config.ComplianceSettings.Enable;
    }

    let serverError;
    const error = state.requests.admin.createCompliance.error;
    if (error) {
        serverError = error.message;
    }

    return {
        ...ownProps,
        enabled,
        reports: Object.values(selectComplianceReports(state)),
        serverError
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getComplianceReports,
            createComplianceReport
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ComplianceReports);

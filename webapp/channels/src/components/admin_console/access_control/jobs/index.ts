// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {JobType} from '@mattermost/types/jobs';

import {createJob, getJobsByType} from 'mattermost-redux/actions/jobs';
import {makeGetJobsByType} from 'mattermost-redux/selectors/entities/jobs';

import type {GlobalState} from 'types/store';

import AccessControlSyncJobTable from './access_control_sync_job_table';

function mapStateToProps(state: GlobalState) {
    // Note: 'access_control_sync' is not included in the JobType definition yet
    const accessControlSyncJobType = 'access_control_sync' as any as JobType;
    const getJobsByTypeSelector = makeGetJobsByType(accessControlSyncJobType);
    return {
        jobs: getJobsByTypeSelector(state),
    };
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        createJob,
        getJobsByType,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(AccessControlSyncJobTable);

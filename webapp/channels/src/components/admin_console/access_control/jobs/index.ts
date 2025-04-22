// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {createJob} from 'mattermost-redux/actions/jobs';

import AccessControlSyncJobTable from './access_control_sync_job_table';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        createJob: createJob,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(AccessControlSyncJobTable);

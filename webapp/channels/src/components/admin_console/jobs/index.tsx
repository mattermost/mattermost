// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getJobsByType, createJob, cancelJob} from 'mattermost-redux/actions/jobs';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import {makeGetJobsByType} from 'mattermost-redux/selectors/entities/jobs';

import Table from './table';

import type {Props} from './table';
import type {JobType} from '@mattermost/types/jobs';
import type {GenericAction, ActionFunc, ActionResult} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {GlobalState} from 'types/store';

type OwnProps = Omit<Props, 'actions'|'jobs'|'downloadExportRresults'>;

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        jobs: makeGetJobsByType(ownProps.jobType)(state),
        downloadExportResults: getConfig(state).MessageExportSettings?.DownloadExportResults,
    };
}

type Actions = {
    getJobsByType: (type: JobType) => Promise<ActionResult>;
    createJob: (job: {type: JobType}) => Promise<ActionResult>;
    cancelJob: (id: string) => Promise<ActionResult>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getJobsByType,
            createJob,
            cancelJob,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Table);

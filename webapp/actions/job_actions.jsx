// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as JobsActions from 'mattermost-redux/actions/jobs';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

export function createJob(job, success, error) {
    JobsActions.createJob(job)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.jobs.createJob.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function cancelJob(jobId, success, error) {
    JobsActions.cancelJob(jobId)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.jobs.cancelJob.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {JobsState, JobType, Job, JobsByType} from '@mattermost/types/jobs';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {JobTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

function jobs(state: IDMappedObjects<Job> = {}, action: GenericAction): IDMappedObjects<Job> {
    switch (action.type) {
    case JobTypes.RECEIVED_JOB: {
        const nextState = {...state};
        nextState[action.data.id] = action.data;
        return nextState;
    }
    case JobTypes.RECEIVED_JOBS: {
        const nextState = {...state};
        for (const job of action.data) {
            nextState[job.id] = job;
        }
        return nextState;
    }
    default:
        return state;
    }
}

function jobsByTypeList(state: JobsByType = {}, action: GenericAction): JobsByType {
    switch (action.type) {
    case JobTypes.RECEIVED_JOBS_BY_TYPE: {
        const nextState = {...state};
        if (action.data && action.data.length && action.data.length > 0) {
            nextState[action.data[0].type as JobType] = action.data;
        }
        return nextState;
    }
    default:
        return state;
    }
}

export default (combineReducers({

    // object where every key is the job id and has an object with the job details
    jobs,

    // object where every key is a job type and contains a list of jobs.
    jobsByTypeList,
}) as (b: JobsState, a: GenericAction) => JobsState);

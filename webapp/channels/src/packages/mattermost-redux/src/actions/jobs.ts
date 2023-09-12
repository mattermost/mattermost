// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JobType, Job} from '@mattermost/types/jobs';

import {JobTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {bindClientFunc} from './helpers';

import {General} from '../constants';

export function createJob(job: Job): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.createJob,
        onSuccess: JobTypes.RECEIVED_JOB,
        params: [
            job,
        ],
    });
}

export function getJob(id: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getJob,
        onSuccess: JobTypes.RECEIVED_JOB,
        params: [
            id,
        ],
    });
}

export function getJobs(page = 0, perPage: number = General.JOBS_CHUNK_SIZE): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getJobs,
        onSuccess: JobTypes.RECEIVED_JOBS,
        params: [
            page,
            perPage,
        ],
    });
}

export function getJobsByType(type: JobType, page = 0, perPage: number = General.JOBS_CHUNK_SIZE): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getJobsByType,
        onSuccess: [JobTypes.RECEIVED_JOBS, JobTypes.RECEIVED_JOBS_BY_TYPE],
        params: [
            type,
            page,
            perPage,
        ],
    });
}

export function cancelJob(job: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.cancelJob,
        params: [
            job,
        ],
    });
}

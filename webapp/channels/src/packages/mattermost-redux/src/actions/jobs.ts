// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JobType, Job, JobTypeBase} from '@mattermost/types/jobs';

import {JobTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {NewActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc} from './helpers';

import {General} from '../constants';

export function createJob(job: JobTypeBase): NewActionFuncAsync<Job> {
    return bindClientFunc({
        clientFunc: Client4.createJob,
        onSuccess: JobTypes.RECEIVED_JOB,
        params: [
            job,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getJob(id: string): NewActionFuncAsync<Job> {
    return bindClientFunc({
        clientFunc: Client4.getJob,
        onSuccess: JobTypes.RECEIVED_JOB,
        params: [
            id,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getJobs(page = 0, perPage: number = General.JOBS_CHUNK_SIZE): NewActionFuncAsync<Job[]> {
    return bindClientFunc({
        clientFunc: Client4.getJobs,
        onSuccess: JobTypes.RECEIVED_JOBS,
        params: [
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getJobsByType(type: JobType, page = 0, perPage: number = General.JOBS_CHUNK_SIZE): NewActionFuncAsync<Job> {
    return bindClientFunc({
        clientFunc: Client4.getJobsByType,
        onSuccess: [JobTypes.RECEIVED_JOBS, JobTypes.RECEIVED_JOBS_BY_TYPE],
        params: [
            type,
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function cancelJob(job: string): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.cancelJob,
        params: [
            job,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

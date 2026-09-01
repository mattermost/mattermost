// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Job} from '@mattermost/types/jobs';

import {JobTypes} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/jobs';

describe('reducers/entities/jobs', () => {
    describe('jobsByTypeList RECEIVED_JOB', () => {
        const makeJob = (overrides: Partial<Job> = {}): Job => ({
            id: 'job1',
            type: 'ldap_sync',
            status: 'pending',
            priority: 0,
            create_at: 0,
            start_at: 0,
            last_activity_at: 0,
            progress: 0,
            data: null,
            ...overrides,
        });

        it('leaves jobsByTypeList unchanged when job type has no existing list', () => {
            const job = makeJob({id: 'job1', type: 'ldap_sync', status: 'success'});
            const initialState = {
                jobs: {},
                jobsByTypeList: {},
            };

            const newState = reducer(initialState, {type: JobTypes.RECEIVED_JOB, data: job});

            expect(newState.jobsByTypeList).toBe(initialState.jobsByTypeList);
        });

        it('prepends job to the type list when job id is not already in the list', () => {
            const existingJob = makeJob({id: 'other_job', type: 'ldap_sync', status: 'pending'});
            const newJob = makeJob({id: 'job1', type: 'ldap_sync', status: 'in_progress'});
            const initialState = {
                jobs: {},
                jobsByTypeList: {ldap_sync: [existingJob]},
            };

            const newState = reducer(initialState, {type: JobTypes.RECEIVED_JOB, data: newJob});

            expect(newState.jobsByTypeList.ldap_sync).toHaveLength(2);
            expect(newState.jobsByTypeList.ldap_sync![0]).toBe(newJob);
            expect(newState.jobsByTypeList.ldap_sync![1]).toBe(existingJob);
            expect(newState.jobsByTypeList).not.toBe(initialState.jobsByTypeList);
        });

        it('updates the matching job in the type list when id is found', () => {
            const original = makeJob({id: 'job1', type: 'ldap_sync', status: 'pending'});
            const updated = makeJob({id: 'job1', type: 'ldap_sync', status: 'success'});
            const initialState = {
                jobs: {},
                jobsByTypeList: {ldap_sync: [original]},
            };

            const newState = reducer(initialState, {type: JobTypes.RECEIVED_JOB, data: updated});

            expect(newState.jobsByTypeList.ldap_sync).toHaveLength(1);
            expect(newState.jobsByTypeList.ldap_sync![0].status).toBe('success');
            expect(newState.jobsByTypeList).not.toBe(initialState.jobsByTypeList);
        });

        it('only updates the matching job and preserves others in the list', () => {
            const job1 = makeJob({id: 'job1', type: 'ldap_sync', status: 'pending'});
            const job2 = makeJob({id: 'job2', type: 'ldap_sync', status: 'pending'});
            const updatedJob1 = makeJob({id: 'job1', type: 'ldap_sync', status: 'in_progress'});
            const initialState = {
                jobs: {},
                jobsByTypeList: {ldap_sync: [job1, job2]},
            };

            const newState = reducer(initialState, {type: JobTypes.RECEIVED_JOB, data: updatedJob1});

            expect(newState.jobsByTypeList.ldap_sync).toHaveLength(2);
            expect(newState.jobsByTypeList.ldap_sync![0].status).toBe('in_progress');
            expect(newState.jobsByTypeList.ldap_sync![1]).toBe(job2);
        });
    });
});

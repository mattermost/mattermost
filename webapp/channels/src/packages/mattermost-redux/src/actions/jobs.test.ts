// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {Job} from '@mattermost/types/jobs';

import * as Actions from 'mattermost-redux/actions/jobs';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

const OK_RESPONSE = {status: 'OK'};

describe('Actions.Jobs', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('createJob', async () => {
        const job = {
            type: 'data_retention',
        } as Job;

        nock(Client4.getBaseRoute()).
            post('/jobs').
            reply(201, {
                id: 'six4h67ja7ntdkek6g13dp3wka',
                create_at: 1491399241953,
                type: 'data_retention',
                status: 'pending',
                data: {},
            });

        await store.dispatch(Actions.createJob(job));

        const state = store.getState();
        const jobs = state.entities.jobs.jobs;
        expect(jobs.six4h67ja7ntdkek6g13dp3wka).toBeTruthy();
    });

    it('getJob', async () => {
        nock(Client4.getBaseRoute()).
            get('/jobs/six4h67ja7ntdkek6g13dp3wka').
            reply(200, {
                id: 'six4h67ja7ntdkek6g13dp3wka',
                create_at: 1491399241953,
                type: 'data_retention',
                status: 'pending',
                data: {},
            });

        await store.dispatch(Actions.getJob('six4h67ja7ntdkek6g13dp3wka'));

        const state = store.getState();
        const jobs = state.entities.jobs.jobs;
        expect(jobs.six4h67ja7ntdkek6g13dp3wka).toBeTruthy();
    });

    it('cancelJob', async () => {
        nock(Client4.getBaseRoute()).
            post('/jobs/six4h67ja7ntdkek6g13dp3wka/cancel').
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.cancelJob('six4h67ja7ntdkek6g13dp3wka'));

        const state = store.getState();
        const jobs = state.entities.jobs.jobs;
        expect(!jobs.six4h67ja7ntdkek6g13dp3wka).toBeTruthy();
    });

    it('getJobs', async () => {
        nock(Client4.getBaseRoute()).
            get('/jobs').
            query(true).
            reply(200, [{
                id: 'six4h67ja7ntdkek6g13dp3wka',
                create_at: 1491399241953,
                type: 'data_retention',
                status: 'pending',
                data: {},
            }]);

        await store.dispatch(Actions.getJobs());

        const state = store.getState();
        const jobs = state.entities.jobs.jobs;
        expect(jobs.six4h67ja7ntdkek6g13dp3wka).toBeTruthy();
    });

    it('getJobsByType', async () => {
        nock(Client4.getBaseRoute()).
            get('/jobs/type/data_retention').
            query(true).
            reply(200, [{
                id: 'six4h67ja7ntdkek6g13dp3wka',
                create_at: 1491399241953,
                type: 'data_retention',
                status: 'pending',
                data: {},
            }]);

        await store.dispatch(Actions.getJobsByType('data_retention'));

        const state = store.getState();

        const jobs = state.entities.jobs.jobs;
        expect(jobs.six4h67ja7ntdkek6g13dp3wka).toBeTruthy();

        const jobsByType = state.entities.jobs.jobsByTypeList;
        expect(jobsByType.data_retention).toBeTruthy();
        expect(jobsByType.data_retention.length === 1).toBeTruthy();
    });
});

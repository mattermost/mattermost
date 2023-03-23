// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/schemes';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.Schemes', () => {
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

    it('getSchemes', async () => {
        const mockScheme = TestHelper.basicScheme;

        nock(Client4.getBaseRoute()).
            get('/schemes').
            query(true).
            reply(200, [mockScheme]);

        await Actions.getSchemes('team')(store.dispatch, store.getState);
        const {schemes} = store.getState().entities.schemes;

        expect(Object.keys(schemes).length > 0).toBeTruthy();
    });

    it('createScheme', async () => {
        const mockScheme = TestHelper.basicScheme;

        nock(Client4.getBaseRoute()).
            post('/schemes').
            reply(201, mockScheme!);
        await Actions.createScheme(TestHelper.mockScheme())(store.dispatch, store.getState);

        const {schemes} = store.getState().entities.schemes;

        const schemeId = Object.keys(schemes)[0];
        expect(Object.keys(schemes).length).toEqual(1);
        expect(mockScheme!.id).toEqual(schemeId);
    });

    it('getScheme', async () => {
        nock(Client4.getBaseRoute()).
            get('/schemes/' + TestHelper.basicScheme!.id).
            reply(200, TestHelper.basicScheme!);

        await Actions.getScheme(TestHelper.basicScheme!.id)(store.dispatch, store.getState);

        const state = store.getState();
        const {schemes} = state.entities.schemes;

        expect(schemes[TestHelper.basicScheme!.id].name).toEqual(TestHelper.basicScheme!.name);
    });

    it('patchScheme', async () => {
        const patchData = {name: 'The Updated Scheme', description: 'This is a scheme created by unit tests'};
        const scheme = {
            ...TestHelper.basicScheme,
            ...patchData,
        };

        nock(Client4.getBaseRoute()).
            put('/schemes/' + TestHelper.basicScheme!.id + '/patch').
            reply(200, scheme);

        await Actions.patchScheme(TestHelper.basicScheme!.id, scheme)(store.dispatch, store.getState);

        const state = store.getState();
        const {schemes} = state.entities.schemes;

        const updated = schemes[TestHelper.basicScheme!.id];
        expect(updated).toBeTruthy();
        expect(updated.name).toEqual(patchData.name);
        expect(updated.description).toEqual(patchData.description);
    });

    it('deleteScheme', async () => {
        nock(Client4.getBaseRoute()).
            delete('/schemes/' + TestHelper.basicScheme!.id).
            reply(200, {status: 'OK'});

        await Actions.deleteScheme(TestHelper.basicScheme!.id)(store.dispatch, store.getState);

        const state = store.getState();
        const {schemes} = state.entities.schemes;

        expect(schemes).not.toBe({});
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/emojis';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

import type {ActionResult} from 'mattermost-redux/types/actions';

const OK_RESPONSE = {status: 'OK'};

describe('Actions.Emojis', () => {
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

    it('createCustomEmoji', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        const state = store.getState();

        const emojis = state.entities.emojis.customEmoji;
        expect(emojis).toBeTruthy();
        expect(emojis[created.id]).toBeTruthy();
    });

    it('getCustomEmojis', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get('/emoji').
            query(true).
            reply(200, [created]);

        await Actions.getCustomEmojis()(store.dispatch, store.getState);

        const state = store.getState();

        const emojis = state.entities.emojis.customEmoji;
        expect(emojis).toBeTruthy();
        expect(emojis[created.id]).toBeTruthy();
    });

    it('deleteCustomEmoji', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});
        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            delete(`/emoji/${created.id}`).
            reply(200, OK_RESPONSE);

        await Actions.deleteCustomEmoji(created.id)(store.dispatch, store.getState);

        const state = store.getState();

        const emojis = state.entities.emojis.customEmoji;
        expect(!emojis[created.id]).toBeTruthy();
    });

    it('loadProfilesForCustomEmojis', async () => {
        const fakeUser = TestHelper.fakeUser();
        fakeUser.id = TestHelper.generateId();
        const junkUserId = TestHelper.generateId();

        const testEmojis = [TestHelper.getCustomEmojiMock({
            name: TestHelper.generateId(),
            creator_id: TestHelper.basicUser!.id,
        }),
        TestHelper.getCustomEmojiMock({
            name: TestHelper.generateId(),
            creator_id: TestHelper.basicUser!.id,
        }),
        TestHelper.getCustomEmojiMock({
            name: TestHelper.generateId(),
            creator_id: fakeUser.id,
        }),
        TestHelper.getCustomEmojiMock({
            name: TestHelper.generateId(),
            creator_id: junkUserId,
        })];

        nock(Client4.getUsersRoute()).
            post('/ids').
            reply(200, [TestHelper.basicUser, fakeUser]);

        await store.dispatch(Actions.loadProfilesForCustomEmojis(testEmojis));

        const state = store.getState();
        const profiles = state.entities.users.profiles;
        expect(profiles[TestHelper.basicUser!.id]).toBeTruthy();
        expect(profiles[fakeUser.id]).toBeTruthy();
        expect(!profiles[junkUserId]).toBeTruthy();
    });

    it('searchCustomEmojis', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            post('/emoji/search').
            reply(200, [created]);

        await Actions.searchCustomEmojis(created.name, {prefix_only: true})(store.dispatch, store.getState);

        const state = store.getState();

        const emojis = state.entities.emojis.customEmoji;
        expect(emojis).toBeTruthy();
        expect(emojis[created.id]).toBeTruthy();
    });

    it('autocompleteCustomEmojis', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get('/emoji/autocomplete').
            query(true).
            reply(200, [created]);

        await Actions.autocompleteCustomEmojis(created.name)(store.dispatch, store.getState);

        const state = store.getState();

        const emojis = state.entities.emojis.customEmoji;
        expect(emojis).toBeTruthy();
        expect(emojis[created.id]).toBeTruthy();
    });

    it('getCustomEmoji', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get(`/emoji/${created.id}`).
            reply(200, created);

        await Actions.getCustomEmoji(created.id)(store.dispatch, store.getState);

        const state = store.getState();

        const emojis = state.entities.emojis.customEmoji;
        expect(emojis).toBeTruthy();
        expect(emojis[created.id]).toBeTruthy();
    });

    it('getCustomEmojiByName', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get(`/emoji/name/${created.name}`).
            reply(200, created);

        await Actions.getCustomEmojiByName(created.name)(store.dispatch, store.getState);

        let state = store.getState();

        const emojis = state.entities.emojis.customEmoji;
        expect(emojis).toBeTruthy();
        expect(emojis[created.id]).toBeTruthy();

        const missingName = TestHelper.generateId();

        nock(Client4.getBaseRoute()).
            get(`/emoji/name/${missingName}`).
            reply(404, {message: 'Not found', status_code: 404});

        await Actions.getCustomEmojiByName(missingName)(store.dispatch, store.getState);

        state = store.getState();
        expect(state.entities.emojis.nonExistentEmoji.has(missingName)).toBeTruthy();
    });

    it('getCustomEmojisByName', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get(`/emoji/name/${created.name}`).
            reply(200, created);

        const missingName = TestHelper.generateId();

        nock(Client4.getBaseRoute()).
            get(`/emoji/name/${missingName}`).
            reply(404, {message: 'Not found', status_code: 404});

        await Actions.getCustomEmojisByName([created.name, missingName])(store.dispatch, store.getState);

        const state = store.getState();
        expect(state.entities.emojis.customEmoji[created.id]).toBeTruthy();
        expect(state.entities.emojis.nonExistentEmoji.has(missingName)).toBeTruthy();
    });

    it('getCustomEmojisInText', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        )(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get(`/emoji/name/${created.name}`).
            reply(200, created);

        const missingName = TestHelper.generateId();

        nock(Client4.getBaseRoute()).
            get(`/emoji/name/${missingName}`).
            reply(404, {message: 'Not found', status_code: 404});

        await Actions.getCustomEmojisInText(`some text :${created.name}: :${missingName}:`)(store.dispatch, store.getState);

        const state = store.getState();
        expect(state.entities.emojis.customEmoji[created.id]).toBeTruthy();
        expect(state.entities.emojis.nonExistentEmoji.has(missingName)).toBeTruthy();
    });
});

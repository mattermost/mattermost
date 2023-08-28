// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import {EmojiTypes} from 'mattermost-redux/action_types';
import * as Actions from 'mattermost-redux/actions/emojis';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore, {mockDispatch} from '../../test/test_store';

const OK_RESPONSE = {status: 'OK'};

describe('Actions.Emojis', () => {
    let store = configureStore().store;
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

        const {data: created} = await store.dispatch(Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        ));

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

        const {data: created} = await store.dispatch(Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        ));

        nock(Client4.getBaseRoute()).
            get('/emoji').
            query(true).
            reply(200, [created]);

        await store.dispatch(Actions.getCustomEmojis());

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
        const {data: created} = await store.dispatch(Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        ));

        nock(Client4.getBaseRoute()).
            delete(`/emoji/${created.id}`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.deleteCustomEmoji(created.id));

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

        const {data: created} = await store.dispatch(Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        ));

        nock(Client4.getBaseRoute()).
            post('/emoji/search').
            reply(200, [created]);

        await store.dispatch(Actions.searchCustomEmojis(created.name, {prefix_only: true}));

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

        const {data: created} = await store.dispatch(Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        ));

        nock(Client4.getBaseRoute()).
            get('/emoji/autocomplete').
            query(true).
            reply(200, [created]);

        await store.dispatch(Actions.autocompleteCustomEmojis(created.name));

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

        const {data: created} = await store.dispatch(Actions.createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        ));

        nock(Client4.getBaseRoute()).
            get(`/emoji/${created.id}`).
            reply(200, created);

        await store.dispatch(Actions.getCustomEmoji(created.id));

        const state = store.getState();

        const emojis = state.entities.emojis.customEmoji;
        expect(emojis).toBeTruthy();
        expect(emojis[created.id]).toBeTruthy();
    });

    // HARRISON TODO test the new functions?

    it('getCustomEmojisInText', async () => {
        // HARRISON TODO also this function is impossible to test because of the mix of thunk and saga
        store.dispatch = mockDispatch(store.dispatch);

        const created = {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()};
        const missingName = TestHelper.generateId();

        nock(Client4.getBaseRoute()).
            get(`/emoji/name/${created.name}`).
            reply(200, created);

        nock(Client4.getBaseRoute()).
            post('/emoji/names', [created.name, missingName]).
            reply(200, [created]);

        await store.dispatch(Actions.getCustomEmojisInText(`some text :${created.name}: :${missingName}:`));

        expect(store.dispatch.actions[1]).toEqual({
            type: EmojiTypes.FETCH_EMOJIS_BY_NAME,
            names: [created.name, missingName],
        });

        // console.log(store);
        // const state = store.getState();

        // expect(state.entities.emojis.customEmoji[created.id]).toBeTruthy();
        // expect(state.entities.emojis.nonExistentEmoji.has(missingName)).toBeTruthy();
    });
});

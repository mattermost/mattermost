// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/emojis';
import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

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

    describe('getCustomEmojisByName', () => {
        test('should be able to request a single emoji', async () => {
            const emoji1 = TestHelper.getCustomEmojiMock({name: 'emoji1', id: 'emojiId1'});

            nock(Client4.getBaseRoute()).
                post('/emoji/names', ['emoji1']).
                reply(200, [emoji1]);

            await store.dispatch(Actions.getCustomEmojisByName(['emoji1']));

            const state = store.getState();
            expect(state.entities.emojis.customEmoji[emoji1.id]).toEqual(emoji1);
        });

        test('should be able to request multiple emojis', async () => {
            const emoji1 = TestHelper.getCustomEmojiMock({name: 'emoji1', id: 'emojiId1'});
            const emoji2 = TestHelper.getCustomEmojiMock({name: 'emoji2', id: 'emojiId2'});

            nock(Client4.getBaseRoute()).
                post('/emoji/names', ['emoji1', 'emoji2']).
                reply(200, [emoji1, emoji2]);

            await store.dispatch(Actions.getCustomEmojisByName(['emoji1', 'emoji2']));

            const state = store.getState();
            expect(state.entities.emojis.customEmoji[emoji1.id]).toEqual(emoji1);
            expect(state.entities.emojis.customEmoji[emoji2.id]).toEqual(emoji2);
        });

        test('should correctly track non-existent emojis', async () => {
            const emoji1 = TestHelper.getCustomEmojiMock({name: 'emoji1', id: 'emojiId1'});

            nock(Client4.getBaseRoute()).
                post('/emoji/names', ['emoji1', 'emoji2']).
                reply(200, [emoji1]);

            await store.dispatch(Actions.getCustomEmojisByName(['emoji1', 'emoji2']));

            const state = store.getState();
            expect(state.entities.emojis.customEmoji[emoji1.id]).toEqual(emoji1);
            expect(state.entities.emojis.nonExistentEmoji).toEqual(new Set(['emoji2']));
        });

        test('should be able to request over 200 emojis', async () => {
            const emojis = [];
            for (let i = 0; i < 500; i++) {
                emojis.push(TestHelper.getCustomEmojiMock({name: 'emoji' + i, id: 'emojiId' + i}));
            }

            const names = emojis.map((emoji) => emoji.name);

            nock(Client4.getBaseRoute()).
                post('/emoji/names', names.slice(0, 200)).
                reply(200, emojis.slice(0, 200));
            nock(Client4.getBaseRoute()).
                post('/emoji/names', names.slice(200, 400)).
                reply(200, emojis.slice(200, 400));
            nock(Client4.getBaseRoute()).
                post('/emoji/names', names.slice(400, 500)).
                reply(200, emojis.slice(400, 500));

            await store.dispatch(Actions.getCustomEmojisByName(names));

            const state = store.getState();
            expect(Object.keys(state.entities.emojis.customEmoji)).toHaveLength(emojis.length);
            for (const emoji of emojis) {
                expect(state.entities.emojis.customEmoji[emoji.id]).toEqual(emoji);
            }
        });
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

        const missingName = TestHelper.generateId();

        nock(Client4.getBaseRoute()).
            post('/emoji/names', [created.name, missingName]).
            reply(200, [created]);

        await Actions.getCustomEmojisInText(`some text :${created.name}: :${missingName}:`)(store.dispatch, store.getState);

        const state = store.getState();
        expect(state.entities.emojis.customEmoji[created.id]).toBeTruthy();
        expect(state.entities.emojis.nonExistentEmoji.has(missingName)).toBeTruthy();
    });
});

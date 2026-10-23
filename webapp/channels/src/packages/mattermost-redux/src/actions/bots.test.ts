// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import * as BotActions from 'mattermost-redux/actions/bots';
import * as UserActions from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.Bots', () => {
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

    it('loadBots', async () => {
        const bots = [TestHelper.fakeBot(), TestHelper.fakeBot()];
        nock(Client4.getBaseRoute()).
            get('/bots').
            query(true).
            reply(201, bots);

        await store.dispatch(BotActions.loadBots());

        const state = store.getState();
        const botsResult = state.entities.bots.accounts;
        expect(bots.length).toEqual(Object.values(botsResult).length);
    });

    it('loadBot', async () => {
        const bot = TestHelper.fakeBot();
        nock(Client4.getBaseRoute()).
            get(`/bots/${bot.user_id}`).
            query(true).
            reply(201, bot);

        await store.dispatch(BotActions.loadBot(bot.user_id));

        const state = store.getState();
        const botsResult = state.entities.bots.accounts[bot.user_id];
        expect(bot.username).toEqual(botsResult.username);
    });

    it('createBot', async () => {
        const bot = TestHelper.fakeBot();
        nock(Client4.getBaseRoute()).
            post('/bots').
            reply(200, bot);
        await store.dispatch(BotActions.createBot(bot));

        const state = store.getState();
        const botsResult = state.entities.bots.accounts[bot.user_id];
        expect(bot.username).toEqual(botsResult.username);
    });

    it('patchBot', async () => {
        const bot = TestHelper.fakeBot();
        nock(Client4.getBaseRoute()).
            post('/bots').
            reply(200, bot);
        await store.dispatch(BotActions.createBot(bot));

        bot.username = 'mynewusername';

        nock(Client4.getBaseRoute()).
            put(`/bots/${bot.user_id}`).
            reply(200, bot);
        await store.dispatch(BotActions.patchBot(bot.user_id, bot as any));

        const state = store.getState();
        const botsResult = state.entities.bots.accounts[bot.user_id];
        expect(bot.username).toEqual(botsResult.username);
    });

    it('disableBot', async () => {
        const bot = TestHelper.fakeBot();
        nock(Client4.getBaseRoute()).
            post('/bots').
            reply(200, bot);
        await store.dispatch(BotActions.createBot(bot));

        // Disable the bot by setting delete_at to a value > 0
        bot.delete_at = 1507840900065;
        nock(Client4.getBotRoute(bot.user_id)).
            post('/disable').
            reply(200, bot);
        await store.dispatch(BotActions.disableBot(bot.user_id));

        const state = store.getState();
        const botsResult = state.entities.bots.accounts[bot.user_id];
        expect(bot.delete_at).toEqual(botsResult.delete_at);

        bot.delete_at = 0;
        nock(Client4.getBotRoute(bot.user_id)).
            post('/enable').
            reply(200, bot);
        await store.dispatch(BotActions.enableBot(bot.user_id));

        const state2 = store.getState();
        const botsResult2 = state2.entities.bots.accounts[bot.user_id];
        expect(bot.delete_at).toEqual(botsResult2.delete_at);
    });

    it('assignBot', async () => {
        const bot = TestHelper.fakeBot();
        nock(Client4.getBaseRoute()).
            post('/bots').
            reply(200, bot);
        await store.dispatch(BotActions.createBot(bot));

        bot.owner_id = TestHelper.generateId();
        nock(Client4.getBotRoute(bot.user_id)).
            post('/assign/' + bot.owner_id).
            reply(200, bot);
        await store.dispatch(BotActions.assignBot(bot.user_id, bot.owner_id));

        const state = store.getState();
        const botsResult = state.entities.bots.accounts[bot.user_id];
        expect(bot.owner_id).toEqual(botsResult.owner_id);
    });

    it('logout', async () => {
        // Fill redux store with somthing
        const bot = TestHelper.fakeBot();
        nock(Client4.getBaseRoute()).
            post('/bots').
            reply(200, bot);
        await store.dispatch(BotActions.createBot(bot));

        // Should be cleared by logout
        nock(Client4.getUsersRoute()).
            post('/logout').
            reply(200, {status: 'OK'});
        await store.dispatch(UserActions.logout());

        // Check is clear
        const state = store.getState();
        expect(0).toEqual(Object.keys(state.entities.bots.accounts).length);
    });

    describe('event subscriptions', () => {
        const subscription = {bot_user_id: 'bot1', mode: 'push', callback_url: 'https://example.com/hook', secret: 's3cret', ignore_bot_authors: true, enabled: true, disabled_reason: '', last_delivered_at: 0};

        it('createBotWithEventSubscription keeps the subscription and secret out of the store', async () => {
            const bot = TestHelper.fakeBot();
            nock(Client4.getBaseRoute()).
                post('/bots').
                reply(201, {...bot, event_subscription: subscription});

            const result = await store.dispatch(BotActions.createBotWithEventSubscription(bot, {mode: 'push', callback_url: subscription.callback_url}));

            expect(result.data?.eventSubscription.secret).toBe('s3cret');
            const stored = store.getState().entities.bots.accounts[bot.user_id];
            expect(stored.username).toBe(bot.username);
            expect(JSON.stringify(store.getState())).not.toContain('s3cret');
        });

        it.each([403, 404])('getBotEventSubscription returns null data on %i', async (status) => {
            nock(Client4.getBotRoute('bot1')).
                get('/event_subscription').
                reply(status, {message: 'nope', status_code: status});

            const result = await store.dispatch(BotActions.getBotEventSubscription('bot1'));

            expect(result).toEqual({data: null});
        });
    });
});

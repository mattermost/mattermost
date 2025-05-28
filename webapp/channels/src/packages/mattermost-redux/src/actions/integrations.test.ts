// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {DialogSubmission, IncomingWebhook, OutgoingWebhook} from '@mattermost/types/integrations';

import * as Actions from 'mattermost-redux/actions/integrations';
import * as TeamsActions from 'mattermost-redux/actions/teams';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

const OK_RESPONSE = {status: 'OK'};

describe('Actions.Integrations', () => {
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

    it('createIncomingHook', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/incoming').
            reply(201, TestHelper.testIncomingHook());

        const {data: created} = await store.dispatch(Actions.createIncomingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                display_name: 'test',
                description: 'test',
            } as IncomingWebhook,
        ));

        const state = store.getState();

        const hooks = state.entities.integrations.incomingHooks;
        expect(hooks).toBeTruthy();
        expect(hooks[created.id]).toBeTruthy();
    });

    it('getIncomingWebhook', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/incoming').
            reply(201, TestHelper.testIncomingHook());

        const {data: created} = await store.dispatch(Actions.createIncomingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                display_name: 'test',
                description: 'test',
            } as IncomingWebhook,
        ));

        nock(Client4.getBaseRoute()).
            get(`/hooks/incoming/${created.id}`).
            reply(200, created);

        await store.dispatch(Actions.getIncomingHook(created.id));
        const state = store.getState();

        const hooks = state.entities.integrations.incomingHooks;
        expect(hooks).toBeTruthy();
        expect(hooks[created.id]).toBeTruthy();
    });

    it('getIncomingWebhooks', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/incoming').
            reply(201, TestHelper.testIncomingHook());

        const {data: created} = await store.dispatch(Actions.createIncomingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                display_name: 'test',
                description: 'test',
            } as IncomingWebhook,
        ));

        /* Test with include_total_count being set to false */
        nock(Client4.getBaseRoute()).
            get('/hooks/incoming').
            query(true).
            reply(200, [created]);

        const response = await store.dispatch(Actions.getIncomingHooks(TestHelper.basicTeam!.id));
        expect(response.data).toBeTruthy();
        expect(response.data[0].id === created.id).toBeTruthy();

        const state = store.getState();
        const hooks = state.entities.integrations.incomingHooks;
        expect(hooks).toBeTruthy();
        expect(hooks[created.id]).toBeTruthy();

        /* Test with include_total_count being set to true */
        nock(Client4.getBaseRoute()).
            get('/hooks/incoming').
            query(true).
            reply(200, {incoming_webhooks: [created], total_count: 1});

        const responseWithCount = await store.dispatch(Actions.getIncomingHooks(TestHelper.basicTeam!.id, 0, 10, true));
        expect(responseWithCount.data.incoming_webhooks).toBeTruthy();
        expect(responseWithCount.data.incoming_webhooks[0].id === created.id).toBeTruthy();
        expect(responseWithCount.data.total_count === 1).toBeTruthy();
    });

    it('removeIncomingHook', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/incoming').
            reply(201, TestHelper.testIncomingHook());

        const {data: created} = await store.dispatch(Actions.createIncomingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                display_name: 'test',
                description: 'test',
            } as IncomingWebhook,
        ));

        nock(Client4.getBaseRoute()).
            delete(`/hooks/incoming/${created.id}`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.removeIncomingHook(created.id));
        const state = store.getState();

        const hooks = state.entities.integrations.incomingHooks;
        expect(!hooks[created.id]).toBeTruthy();
    });

    it('updateIncomingHook', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/incoming').
            reply(201, TestHelper.testIncomingHook());

        const {data: created} = await store.dispatch(Actions.createIncomingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                display_name: 'test',
                description: 'test',
            } as IncomingWebhook,
        ));

        const updated = {...created};
        updated.display_name = 'test2';

        nock(Client4.getBaseRoute()).
            put(`/hooks/incoming/${created.id}`).
            reply(200, updated);
        await store.dispatch(Actions.updateIncomingHook(updated));
        const state = store.getState();

        const hooks = state.entities.integrations.incomingHooks;
        expect(hooks[created.id]).toBeTruthy();
        expect(hooks[created.id].display_name === updated.display_name).toBeTruthy();
    });

    it('createOutgoingHook', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/outgoing').
            reply(201, TestHelper.testOutgoingHook());

        const {data: created} = await store.dispatch(Actions.createOutgoingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                team_id: TestHelper.basicTeam!.id,
                display_name: 'test',
                trigger_words: [TestHelper.generateId()],
                callback_urls: ['http://localhost/notarealendpoint'],
            } as OutgoingWebhook,
        ));

        const state = store.getState();

        const hooks = state.entities.integrations.outgoingHooks;
        expect(hooks).toBeTruthy();
        expect(hooks[created.id]).toBeTruthy();
    });

    it('getOutgoingWebhook', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/outgoing').
            reply(201, TestHelper.testOutgoingHook());

        const {data: created} = await store.dispatch(Actions.createOutgoingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                team_id: TestHelper.basicTeam!.id,
                display_name: 'test',
                trigger_words: [TestHelper.generateId()],
                callback_urls: ['http://localhost/notarealendpoint'],
            } as OutgoingWebhook,
        ));

        nock(Client4.getBaseRoute()).
            get(`/hooks/outgoing/${created.id}`).
            reply(200, TestHelper.testOutgoingHook());

        await store.dispatch(Actions.getOutgoingHook(created.id));
        const state = store.getState();

        const hooks = state.entities.integrations.outgoingHooks;
        expect(hooks).toBeTruthy();
        expect(hooks[created.id]).toBeTruthy();
    });

    it('getOutgoingWebhooks', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/outgoing').
            reply(201, TestHelper.testOutgoingHook());

        const {data: created} = await store.dispatch(Actions.createOutgoingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                team_id: TestHelper.basicTeam!.id,
                display_name: 'test',
                trigger_words: [TestHelper.generateId()],
                callback_urls: ['http://localhost/notarealendpoint'],
            } as OutgoingWebhook,
        ));

        nock(Client4.getBaseRoute()).
            get('/hooks/outgoing').
            query(true).
            reply(200, [TestHelper.testOutgoingHook()]);

        await store.dispatch(Actions.getOutgoingHooks(TestHelper.basicChannel!.id));
        const state = store.getState();

        const hooks = state.entities.integrations.outgoingHooks;
        expect(hooks).toBeTruthy();
        expect(hooks[created.id]).toBeTruthy();
    });

    it('removeOutgoingHook', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/outgoing').
            reply(201, TestHelper.testOutgoingHook());

        const {data: created} = await store.dispatch(Actions.createOutgoingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                team_id: TestHelper.basicTeam!.id,
                display_name: 'test',
                trigger_words: [TestHelper.generateId()],
                callback_urls: ['http://localhost/notarealendpoint'],
            } as OutgoingWebhook,
        ));

        nock(Client4.getBaseRoute()).
            delete(`/hooks/outgoing/${created.id}`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.removeOutgoingHook(created.id));
        const state = store.getState();

        const hooks = state.entities.integrations.outgoingHooks;
        expect(!hooks[created.id]).toBeTruthy();
    });

    it('updateOutgoingHook', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/outgoing').
            reply(201, TestHelper.testOutgoingHook());

        const {data: created} = await store.dispatch(Actions.createOutgoingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                team_id: TestHelper.basicTeam!.id,
                display_name: 'test',
                trigger_words: [TestHelper.generateId()],
                callback_urls: ['http://localhost/notarealendpoint'],
            } as OutgoingWebhook,
        ));

        const updated = {...created};
        updated.display_name = 'test2';
        nock(Client4.getBaseRoute()).
            put(`/hooks/outgoing/${created.id}`).
            reply(200, updated);
        await store.dispatch(Actions.updateOutgoingHook(updated));
        const state = store.getState();

        const hooks = state.entities.integrations.outgoingHooks;
        expect(hooks[created.id]).toBeTruthy();
        expect(hooks[created.id].display_name === updated.display_name).toBeTruthy();
    });

    it('regenOutgoingHookToken', async () => {
        nock(Client4.getBaseRoute()).
            post('/hooks/outgoing').
            reply(201, TestHelper.testOutgoingHook());

        const {data: created} = await store.dispatch(Actions.createOutgoingHook(
            {
                channel_id: TestHelper.basicChannel!.id,
                team_id: TestHelper.basicTeam!.id,
                display_name: 'test',
                trigger_words: [TestHelper.generateId()],
                callback_urls: ['http://localhost/notarealendpoint'],
            } as OutgoingWebhook,
        ));

        nock(Client4.getBaseRoute()).
            post(`/hooks/outgoing/${created.id}/regen_token`).
            reply(200, {...created, token: TestHelper.generateId()});
        await store.dispatch(Actions.regenOutgoingHookToken(created.id));
        const state = store.getState();

        const hooks = state.entities.integrations.outgoingHooks;
        expect(hooks[created.id]).toBeTruthy();
        expect(hooks[created.id].token !== created.token).toBeTruthy();
    });

    it('getCommands', async () => {
        const noTeamCommands = store.getState().entities.integrations.commands;
        const noSystemCommands = store.getState().entities.integrations.systemCommands;
        expect(Object.keys({...noTeamCommands, ...noSystemCommands}).length).toEqual(0);

        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const {data: team} = await store.dispatch(TeamsActions.createTeam(
            TestHelper.fakeTeam(),
        ));

        const teamCommand = TestHelper.testCommand(team.id);

        nock(Client4.getBaseRoute()).
            post('/commands').
            reply(201, {...teamCommand, token: TestHelper.generateId(), id: TestHelper.generateId()});

        const {data: created} = await store.dispatch(Actions.addCommand(
            teamCommand,
        ));

        nock(Client4.getBaseRoute()).
            get('/commands').
            query(true).
            reply(200, [created, {
                trigger: 'system-command',
            }]);

        await store.dispatch(Actions.getCommands(
            team.id,
        ));
        const teamCommands = store.getState().entities.integrations.commands;
        const executableCommands = store.getState().entities.integrations.executableCommands;
        expect(Object.keys({...teamCommands, ...executableCommands}).length).toBeTruthy();
    });

    it('getAutocompleteCommands', async () => {
        const noTeamCommands = store.getState().entities.integrations.commands;
        const noSystemCommands = store.getState().entities.integrations.systemCommands;
        expect(Object.keys({...noTeamCommands, ...noSystemCommands}).length).toEqual(0);

        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const {data: team} = await store.dispatch(TeamsActions.createTeam(
            TestHelper.fakeTeam(),
        ));

        const teamCommandWithAutocomplete = TestHelper.testCommand(team.id);

        nock(Client4.getBaseRoute()).
            post('/commands').
            reply(201, {...teamCommandWithAutocomplete, token: TestHelper.generateId(), id: TestHelper.generateId()});

        const {data: createdWithAutocomplete} = await store.dispatch(Actions.addCommand(
            teamCommandWithAutocomplete,
        ));

        nock(Client4.getBaseRoute()).
            get(`/teams/${team.id}/commands/autocomplete`).
            query(true).
            reply(200, [createdWithAutocomplete, {
                trigger: 'system-command',
            }]);

        await store.dispatch(Actions.getAutocompleteCommands(
            team.id,
        ));
        const teamCommands = store.getState().entities.integrations.commands;
        const systemCommands = store.getState().entities.integrations.systemCommands;
        expect(Object.keys({...teamCommands, ...systemCommands}).length).toEqual(2);
    });

    it('getCustomTeamCommands', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const {data: team} = await store.dispatch(TeamsActions.createTeam(
            TestHelper.fakeTeam(),
        ));

        nock(Client4.getBaseRoute()).
            get('/commands').
            query(true).
            reply(200, []);

        await store.dispatch(Actions.getCustomTeamCommands(
            team.id,
        ));
        const noCommands = store.getState().entities.integrations.commands;
        expect(Object.keys(noCommands).length).toEqual(0);

        const command = TestHelper.testCommand(team.id);

        nock(Client4.getBaseRoute()).
            post('/commands').
            reply(201, {...command, token: TestHelper.generateId(), id: TestHelper.generateId()});

        const {data: created} = await store.dispatch(Actions.addCommand(
            command,
        ));

        nock(Client4.getBaseRoute()).
            get('/commands').
            query(true).
            reply(200, []);

        await store.dispatch(Actions.getCustomTeamCommands(
            team.id,
        ));
        const {commands} = store.getState().entities.integrations;
        expect(commands[created.id]).toBeTruthy();
        expect(Object.keys(commands).length).toEqual(1);
        const actual = commands[created.id];
        const expected = created;
        expect(JSON.stringify(actual)).toEqual(JSON.stringify(expected));
    });

    it('executeCommand', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const {data: team} = await store.dispatch(TeamsActions.createTeam(
            TestHelper.fakeTeam(),
        ));

        const args = {
            channel_id: TestHelper.basicChannel!.id,
            team_id: team.id,
        };

        nock(Client4.getBaseRoute()).
            post('/commands/execute').
            reply(200, []);

        await store.dispatch(Actions.executeCommand('/echo message 5', args));
    });

    it('addCommand', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const {data: team} = await store.dispatch(TeamsActions.createTeam(
            TestHelper.fakeTeam(),
        ));

        const expected = TestHelper.testCommand(team.id);

        nock(Client4.getBaseRoute()).
            post('/commands').
            reply(201, {...expected, token: TestHelper.generateId(), id: TestHelper.generateId()});

        const {data: created} = await store.dispatch(Actions.addCommand(expected));

        const {commands} = store.getState().entities.integrations;
        expect(commands[created.id]).toBeTruthy();
        const actual = commands[created.id];

        expect(actual.token).toBeTruthy();
        expect(actual.create_at).toEqual(actual.update_at);
        expect(actual.delete_at).toEqual(0);
        expect(actual.creator_id).toBeTruthy();
        expect(actual.team_id).toEqual(team.id);
        expect(actual.trigger).toEqual(expected.trigger);
        expect(actual.method).toEqual(expected.method);
        expect(actual.username).toEqual(expected.username);
        expect(actual.icon_url).toEqual(expected.icon_url);
        expect(actual.auto_complete).toEqual(expected.auto_complete);
        expect(actual.auto_complete_desc).toEqual(expected.auto_complete_desc);
        expect(actual.auto_complete_hint).toEqual(expected.auto_complete_hint);
        expect(actual.display_name).toEqual(expected.display_name);
        expect(actual.description).toEqual(expected.description);
        expect(actual.url).toEqual(expected.url);
    });

    it('regenCommandToken', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const {data: team} = await store.dispatch(TeamsActions.createTeam(
            TestHelper.fakeTeam(),
        ));

        const command = TestHelper.testCommand(team.id);

        nock(Client4.getBaseRoute()).
            post('/commands').
            reply(201, {...command, token: TestHelper.generateId(), id: TestHelper.generateId()});

        const {data: created} = await store.dispatch(Actions.addCommand(
            command,
        ));

        nock(Client4.getBaseRoute()).
            put(`/commands/${created.id}/regen_token`).
            reply(200, {...created, token: TestHelper.generateId()});

        await store.dispatch(Actions.regenCommandToken(
            created.id,
        ));
        const {commands} = store.getState().entities.integrations;
        expect(commands[created.id]).toBeTruthy();
        const updated = commands[created.id];

        expect(updated.id).toEqual(created.id);
        expect(updated.token).not.toEqual(created.token);
        expect(updated.create_at).toEqual(created.create_at);
        expect(updated.update_at).toEqual(created.update_at);
        expect(updated.delete_at).toEqual(created.delete_at);
        expect(updated.creator_id).toEqual(created.creator_id);
        expect(updated.team_id).toEqual(created.team_id);
        expect(updated.trigger).toEqual(created.trigger);
        expect(updated.method).toEqual(created.method);
        expect(updated.username).toEqual(created.username);
        expect(updated.icon_url).toEqual(created.icon_url);
        expect(updated.auto_complete).toEqual(created.auto_complete);
        expect(updated.auto_complete_desc).toEqual(created.auto_complete_desc);
        expect(updated.auto_complete_hint).toEqual(created.auto_complete_hint);
        expect(updated.display_name).toEqual(created.display_name);
        expect(updated.description).toEqual(created.description);
        expect(updated.url).toEqual(created.url);
    });

    it('editCommand', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const {data: team} = await store.dispatch(TeamsActions.createTeam(
            TestHelper.fakeTeam(),
        ));

        const command = TestHelper.testCommand(team.id);

        nock(Client4.getBaseRoute()).
            post('/commands').
            reply(201, {...command, token: TestHelper.generateId(), id: TestHelper.generateId()});

        const {data: created} = await store.dispatch(Actions.addCommand(
            command,
        ));

        const expected = Object.assign({}, created);
        expected.trigger = 'modified';
        expected.method = 'G';
        expected.username = 'modified';
        expected.auto_complete = false;

        nock(Client4.getBaseRoute()).
            put(`/commands/${expected.id}`).
            reply(200, {...expected, update_at: 123});

        await store.dispatch(Actions.editCommand(
            expected,
        ));
        const {commands} = store.getState().entities.integrations;
        expect(commands[created.id]).toBeTruthy();
        const actual = commands[created.id];

        expect(actual.update_at).not.toEqual(expected.update_at);
        expected.update_at = actual.update_at;
        expect(JSON.stringify(actual)).toEqual(JSON.stringify(expected));
    });

    it('deleteCommand', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const {data: team} = await store.dispatch(TeamsActions.createTeam(
            TestHelper.fakeTeam(),
        ));

        const command = TestHelper.testCommand(team.id);

        nock(Client4.getBaseRoute()).
            post('/commands').
            reply(201, {...command, token: TestHelper.generateId(), id: TestHelper.generateId()});

        const {data: created} = await store.dispatch(Actions.addCommand(
            command,
        ));

        nock(Client4.getBaseRoute()).
            delete(`/commands/${created.id}`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.deleteCommand(
            created.id,
        ));
        const {commands} = store.getState().entities.integrations;
        expect(!commands[created.id]).toBeTruthy();
    });

    it('addOAuthApp', async () => {
        nock(Client4.getBaseRoute()).
            post('/oauth/apps').
            reply(201, TestHelper.fakeOAuthAppWithId());

        const {data: created} = await store.dispatch(Actions.addOAuthApp(TestHelper.fakeOAuthApp()));

        const {oauthApps} = store.getState().entities.integrations;
        expect(oauthApps[created.id]).toBeTruthy();
    });

    it('getOAuthApp', async () => {
        nock(Client4.getBaseRoute()).
            post('/oauth/apps').
            reply(201, TestHelper.fakeOAuthAppWithId());

        const {data: created} = await store.dispatch(Actions.addOAuthApp(TestHelper.fakeOAuthApp()));

        nock(Client4.getBaseRoute()).
            get(`/oauth/apps/${created.id}`).
            reply(200, created);

        await store.dispatch(Actions.getOAuthApp(created.id));
        const {oauthApps} = store.getState().entities.integrations;
        expect(oauthApps[created.id]).toBeTruthy();
    });

    it('editOAuthApp', async () => {
        nock(Client4.getBaseRoute()).
            post('/oauth/apps').
            reply(201, TestHelper.fakeOAuthAppWithId());

        const {data: created} = await store.dispatch(Actions.addOAuthApp(TestHelper.fakeOAuthApp()));

        const expected = Object.assign({}, created);
        expected.name = 'modified';
        expected.description = 'modified';
        expected.homepage = 'https://modified.com';
        expected.icon_url = 'https://modified.com/icon';
        expected.callback_urls = ['https://modified.com/callback1', 'https://modified.com/callback2'];
        expected.is_trusted = true;

        const nockReply = Object.assign({}, expected);
        nockReply.update_at += 1;
        nock(Client4.getBaseRoute()).
            put(`/oauth/apps/${created.id}`).reply(200, nockReply);

        await store.dispatch(Actions.editOAuthApp(expected));
        const {oauthApps} = store.getState().entities.integrations;
        expect(oauthApps[created.id]).toBeTruthy();

        const actual = oauthApps[created.id];

        expect(actual.update_at).not.toEqual(expected.update_at);
        const actualWithoutUpdateAt = {...actual};
        delete actualWithoutUpdateAt.update_at;
        delete expected.update_at;
        expect(JSON.stringify(actualWithoutUpdateAt)).toEqual(JSON.stringify(expected));
    });

    it('getOAuthApps', async () => {
        nock(Client4.getBaseRoute()).
            post('/oauth/apps').
            reply(201, TestHelper.fakeOAuthAppWithId());

        const {data: created} = await store.dispatch(Actions.addOAuthApp(TestHelper.fakeOAuthApp()));

        const user = TestHelper.basicUser;
        nock(Client4.getBaseRoute()).
            get(`/users/${user!.id}/oauth/apps/authorized`).
            reply(200, [created]);

        await store.dispatch(Actions.getAuthorizedOAuthApps());
        const {oauthApps} = store.getState().entities.integrations;
        expect(oauthApps).toBeTruthy();
    });

    it('deleteOAuthApp', async () => {
        nock(Client4.getBaseRoute()).
            post('/oauth/apps').
            reply(201, TestHelper.fakeOAuthAppWithId());

        const {data: created} = await store.dispatch(Actions.addOAuthApp(TestHelper.fakeOAuthApp()));

        nock(Client4.getBaseRoute()).
            delete(`/oauth/apps/${created.id}`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.deleteOAuthApp(created.id));
        const {oauthApps} = store.getState().entities.integrations;
        expect(!oauthApps[created.id]).toBeTruthy();
    });

    it('regenOAuthAppSecret', async () => {
        nock(Client4.getBaseRoute()).
            post('/oauth/apps').
            reply(201, TestHelper.fakeOAuthAppWithId());

        const {data: created} = await store.dispatch(Actions.addOAuthApp(TestHelper.fakeOAuthApp()));

        nock(Client4.getBaseRoute()).
            post(`/oauth/apps/${created.id}/regen_secret`).
            reply(200, {...created, client_secret: TestHelper.generateId()});

        await store.dispatch(Actions.regenOAuthAppSecret(created.id));
        const {oauthApps} = store.getState().entities.integrations;
        expect(oauthApps[created.id].client_secret !== created.client_secret).toBeTruthy();
    });

    it('submitInteractiveDialog', async () => {
        nock(Client4.getBaseRoute()).
            post('/actions/dialogs/submit').
            reply(200, {errors: {name: 'some error'}});

        const submit: DialogSubmission = {
            url: 'https://mattermost.com',
            callback_id: '123',
            state: '123',
            channel_id: TestHelper.generateId(),
            team_id: TestHelper.generateId(),
            submission: {name: 'value'},
            cancelled: false,
            user_id: '',
        };

        const {data} = await store.dispatch(Actions.submitInteractiveDialog(submit));

        expect(data.errors).toBeTruthy();
        expect(data.errors.name).toEqual('some error');
    });
});

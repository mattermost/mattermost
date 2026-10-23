// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {eventDeliveryState, planEventDeliveryChange} from './bot_event_delivery';
import type {EventDeliveryState} from './bot_event_delivery';
import {botSaveMessages, loadBotAttributeValues, saveBotCreate, saveBotEdit, validateBotForm} from './bot_save_flow';
import type {BotSaveActions} from './bot_save_flow';

const buildActions = (overrides: Partial<BotSaveActions> = {}): BotSaveActions => ({
    createBot: jest.fn().mockResolvedValue({data: TestHelper.getBotMock({user_id: 'bot-user-id'})}),
    createBotWithEventSubscription: jest.fn().mockResolvedValue({data: {bot: TestHelper.getBotMock({user_id: 'bot-user-id'}), eventSubscription: {secret: 'whsec'}}}),
    patchBot: jest.fn().mockResolvedValue({data: TestHelper.getBotMock({user_id: 'bot-user-id'})}),
    uploadProfileImage: jest.fn().mockResolvedValue({data: true}),
    setDefaultProfileImage: jest.fn().mockResolvedValue({data: true}),
    createUserAccessToken: jest.fn().mockResolvedValue({data: TestHelper.getUserAccessTokenMock({token: 'tok'})}),
    updateUserRoles: jest.fn().mockResolvedValue({data: true}),
    getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: []}),
    getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
    updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
    getBotEventSubscription: jest.fn().mockResolvedValue({data: null}),
    upsertBotEventSubscription: jest.fn().mockResolvedValue({data: {secret: 'whsec'}}),
    deleteBotEventSubscription: jest.fn().mockResolvedValue({data: {status: 'OK'}}),
    ...overrides,
});

const MEMBER = {isAdmin: false, postAll: false, postChannels: false};
const ADMIN = {...MEMBER, isAdmin: true};
const png = () => new File(['x'], 'icon', {type: 'image/png'});

describe('bot_save_flow', () => {
    describe('validateBotForm', () => {
        const base = {username: 'testbot', pictureFile: null, maxFileSize: 100, isCreate: true};
        const image = (type: string, size: number) => new File(['x'.repeat(size)], 'icon', {type});

        test('a valid form passes', () => {
            expect(validateBotForm(base)).toBeUndefined();
        });

        test('a short username fails before the image is checked', () => {
            expect(validateBotForm({...base, username: 'ab', pictureFile: image('text/plain', 1)})).toBe(botSaveMessages.invalidUsername);
        });

        test('an unsupported image type fails', () => {
            expect(validateBotForm({...base, pictureFile: image('text/plain', 1)})).toBe(botSaveMessages.invalidImage);
        });

        test('an image over the size limit fails', () => {
            expect(validateBotForm({...base, pictureFile: image('image/png', 101)})).toBe(botSaveMessages.imageTooLarge);
        });

        test('a trailing period fails on create only', () => {
            expect(validateBotForm({...base, username: 'testbot.'})).toBe(botSaveMessages.invalidLastChar);
            expect(validateBotForm({...base, username: 'testbot.', isCreate: false})).toBeUndefined();
        });
    });

    describe('loadBotAttributeValues', () => {
        test('edit fetches fields and values and normalizes values', async () => {
            const actions = buildActions({getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {dept: 'Eng', cleared: null}})});

            await expect(loadBotAttributeValues(actions, 'bot-user-id')).resolves.toEqual({dept: 'Eng'});
            expect(actions.getCustomProfileAttributeFields).toHaveBeenCalledTimes(1);
            expect(actions.getCustomProfileAttributeValues).toHaveBeenCalledWith('bot-user-id');
        });

        test('create fetches fields only', async () => {
            const actions = buildActions();

            await expect(loadBotAttributeValues(actions, undefined)).resolves.toEqual({});
            expect(actions.getCustomProfileAttributeFields).toHaveBeenCalledTimes(1);
            expect(actions.getCustomProfileAttributeValues).not.toHaveBeenCalled();
        });

        test('either failure returns undefined', async () => {
            await expect(loadBotAttributeValues(buildActions({getCustomProfileAttributeFields: jest.fn().mockResolvedValue({error: {}})}), undefined)).resolves.toBeUndefined();
            await expect(loadBotAttributeValues(buildActions({getCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {}})}), 'id')).resolves.toBeUndefined();
        });
    });

    describe('saveBotEdit', () => {
        const base = {
            botUserId: 'bot-user-id',
            patch: {username: 'testbot'},
            pictureFile: null,
            roleUpdate: {currentRoles: 'system_user', choice: MEMBER},
            attributeChanges: {},
            eventDelivery: {kind: 'none'} as const,
        };

        test('an image failure is reported with context and later steps still run', async () => {
            const actions = buildActions({uploadProfileImage: jest.fn().mockResolvedValue({error: {message: 'Too big'}})});

            const result = await saveBotEdit(actions, {...base, pictureFile: png(), roleUpdate: {currentRoles: 'system_user', choice: ADMIN}, attributeChanges: {dept: 'Eng'}});

            expect(result).toEqual({ok: true, failures: [{key: 'image', message: botSaveMessages.imageFailed, error: 'Too big'}], savedAttributes: {dept: 'Eng'}});
            expect(actions.updateUserRoles).toHaveBeenCalledWith('bot-user-id', 'system_user system_admin');
        });

        test('no role update skips the roles call', async () => {
            const actions = buildActions();

            await saveBotEdit(actions, {...base, roleUpdate: undefined});

            expect(actions.updateUserRoles).not.toHaveBeenCalled();
        });

        test('a null picture leaves the image alone', async () => {
            const actions = buildActions();

            await saveBotEdit(actions, base);

            expect(actions.uploadProfileImage).not.toHaveBeenCalled();
            expect(actions.setDefaultProfileImage).not.toHaveBeenCalled();
        });

        test('a failed explicit reset to the default image is reported', async () => {
            const actions = buildActions({setDefaultProfileImage: jest.fn().mockResolvedValue({error: {message: 'Reset failed'}})});

            const result = await saveBotEdit(actions, {...base, pictureFile: 'default'});

            expect(result).toEqual({ok: true, failures: [{key: 'image', message: botSaveMessages.imageFailed, error: 'Reset failed'}], savedAttributes: {}});
        });

        test('a failed attributes save is not reported as saved', async () => {
            const actions = buildActions({updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {message: 'Nope'}})});

            const result = await saveBotEdit(actions, {...base, attributeChanges: {dept: 'Eng'}});

            expect(result).toEqual({ok: true, failures: [{key: 'attributes', message: botSaveMessages.attributesFailed, error: 'Nope'}], savedAttributes: {}});
        });

        test('a patch failure stops immediately', async () => {
            const actions = buildActions({patchBot: jest.fn().mockResolvedValue({error: {message: 'Patch failed'}})});

            await expect(saveBotEdit(actions, {...base, attributeChanges: {dept: 'Eng'}})).resolves.toEqual({ok: false, error: 'Patch failed'});
            expect(actions.updateUserCustomProfileAttributeValues).not.toHaveBeenCalled();
        });
    });

    describe('saveBotEdit event delivery', () => {
        const base = {
            botUserId: 'bot-user-id',
            patch: {username: 'testbot'},
            pictureFile: null,
            attributeChanges: {},
        };
        const patch = {mode: 'push' as const, callback_url: 'https://example.com/hook', ignore_bot_authors: true};

        test('an upsert returns the secret only when the server sent one', async () => {
            const withSecret = await saveBotEdit(buildActions(), {...base, eventDelivery: {kind: 'upsert', patch}});
            const without = await saveBotEdit(
                buildActions({upsertBotEventSubscription: jest.fn().mockResolvedValue({data: {}})}),
                {...base, eventDelivery: {kind: 'upsert', patch}},
            );

            expect(withSecret).toMatchObject({ok: true, failures: [], eventSecret: 'whsec'});
            expect(without).toMatchObject({ok: true, failures: []});
            expect('eventSecret' in without && without.eventSecret).toBeFalsy();
        });

        test('a delete runs the delete action', async () => {
            const actions = buildActions();

            await saveBotEdit(actions, {...base, eventDelivery: {kind: 'delete'}});

            expect(actions.deleteBotEventSubscription).toHaveBeenCalledWith('bot-user-id');
            expect(actions.upsertBotEventSubscription).not.toHaveBeenCalled();
        });

        test('a failure is reported under its own step', async () => {
            const actions = buildActions({upsertBotEventSubscription: jest.fn().mockResolvedValue({error: {message: 'Bad URL'}})});

            const result = await saveBotEdit(actions, {...base, eventDelivery: {kind: 'upsert', patch}});

            expect(result).toMatchObject({ok: true, failures: [{key: 'eventDelivery', message: botSaveMessages.eventDeliveryFailed, error: 'Bad URL'}]});
        });
    });

    describe('planEventDeliveryChange', () => {
        const existing = {bot_user_id: 'bot-user-id', mode: 'push' as const, callback_url: 'https://example.com/hook', ignore_bot_authors: true, enabled: true, disabled_reason: '' as const, last_delivered_at: 0};
        const pushState = eventDeliveryState(existing);

        test.each<[string, EventDeliveryState, unknown]>([
            ['not ready', {...pushState, status: 'loading'}, {kind: 'none'}],
            ['none without a subscription', eventDeliveryState(null), {kind: 'none'}],
            ['none with a subscription', {...pushState, mode: 'none'}, {kind: 'delete'}],
            ['unchanged', pushState, {kind: 'none'}],
            ['URL (trimmed) unchanged', {...pushState, callbackUrl: ` ${existing.callback_url} `}, {kind: 'none'}],
            ['URL change', {...pushState, callbackUrl: 'https://example.com/other'}, {kind: 'upsert', patch: {mode: 'push', callback_url: 'https://example.com/other', ignore_bot_authors: true}}],
            ['ignore flag change', {...pushState, ignoreBotAuthors: false}, {kind: 'upsert', patch: {mode: 'push', callback_url: existing.callback_url, ignore_bot_authors: false}}],
            ['push to pull omits the URL', {...pushState, mode: 'pull'}, {kind: 'upsert', patch: {mode: 'pull', ignore_bot_authors: true}}],
            ['new push subscription', {...eventDeliveryState(null), mode: 'push', callbackUrl: 'https://example.com/new'}, {kind: 'upsert', patch: {mode: 'push', callback_url: 'https://example.com/new', ignore_bot_authors: true}}],
        ])('%s', (_name, state, expected) => {
            expect(planEventDeliveryChange(state)).toEqual(expected);
        });
    });

    describe('saveBotCreate', () => {
        const base = {
            bot: {username: 'testbot'},
            teamName: 'team',
            expiresAt: 0,
            pictureFile: null,
            roleUpdate: {currentRoles: 'system_user', choice: MEMBER},
            attributeChanges: {},
        };
        const CONFIRM_URL = '/team/integrations/confirm?type=bots&id=bot-user-id&token=tok';

        test('a null picture sets the default image', async () => {
            const actions = buildActions();

            await expect(saveBotCreate(actions, base)).resolves.toEqual({ok: true, redirectUrl: CONFIRM_URL});
            expect(actions.setDefaultProfileImage).toHaveBeenCalledWith('bot-user-id');
        });

        test('a failed automatic default image is not surfaced as a warning', async () => {
            const actions = buildActions({setDefaultProfileImage: jest.fn().mockResolvedValue({error: {message: 'Reset failed'}})});

            await expect(saveBotCreate(actions, base)).resolves.toEqual({ok: true, redirectUrl: CONFIRM_URL});
            expect(actions.setDefaultProfileImage).toHaveBeenCalledTimes(1);
        });

        test('a failed explicit reset to the default image is surfaced as a warning', async () => {
            const actions = buildActions({setDefaultProfileImage: jest.fn().mockResolvedValue({error: {message: 'Reset failed'}})});

            await expect(saveBotCreate(actions, {...base, pictureFile: 'default'})).resolves.toEqual({ok: true, redirectUrl: `${CONFIRM_URL}&bot_warnings=image`});
            expect(actions.setDefaultProfileImage).toHaveBeenCalledTimes(1);
        });

        test('an image failure is surfaced as a warning', async () => {
            const actions = buildActions({uploadProfileImage: jest.fn().mockResolvedValue({error: {message: 'Too big'}})});

            await expect(saveBotCreate(actions, {...base, pictureFile: png()})).resolves.toEqual({ok: true, redirectUrl: `${CONFIRM_URL}&bot_warnings=image`});
        });

        test('roles and attributes failures are surfaced as warnings', async () => {
            const actions = buildActions({
                updateUserRoles: jest.fn().mockResolvedValue({error: {message: 'Denied'}}),
                updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {message: 'Nope'}}),
            });

            const result = await saveBotCreate(actions, {...base, roleUpdate: {currentRoles: 'system_user', choice: ADMIN}, attributeChanges: {dept: 'Eng'}});

            expect(result).toEqual({ok: true, redirectUrl: `${CONFIRM_URL}&bot_warnings=roles,attributes`});
        });

        test('a subscription creates through the combined action and puts the secret in the redirect', async () => {
            const actions = buildActions();
            const eventSubscription = {mode: 'push' as const, callback_url: 'https://example.com/hook'};

            const result = await saveBotCreate(actions, {...base, eventSubscription});

            expect(result).toEqual({ok: true, redirectUrl: `${CONFIRM_URL}&secret=whsec`});
            expect(actions.createBotWithEventSubscription).toHaveBeenCalledWith(base.bot, eventSubscription);
            expect(actions.createBot).not.toHaveBeenCalled();
        });

        test('a subscription failure stops immediately', async () => {
            const actions = buildActions({createBotWithEventSubscription: jest.fn().mockResolvedValue({error: {message: 'Bad URL'}})});

            await expect(saveBotCreate(actions, {...base, eventSubscription: {mode: 'pull'}})).resolves.toEqual({ok: false, error: 'Bad URL'});
            expect(actions.createUserAccessToken).not.toHaveBeenCalled();
        });

        test('a create failure stops immediately', async () => {
            const actions = buildActions({createBot: jest.fn().mockResolvedValue({error: {message: 'Taken'}})});

            await expect(saveBotCreate(actions, base)).resolves.toEqual({ok: false, error: 'Taken'});
            expect(actions.createUserAccessToken).not.toHaveBeenCalled();
        });
    });
});

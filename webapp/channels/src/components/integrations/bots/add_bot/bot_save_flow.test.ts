// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {botSaveMessages, loadBotAttributeValues, saveBotEdit, validateBotForm} from './bot_save_flow';
import type {BotSaveActions} from './bot_save_flow';

const buildActions = (overrides: Partial<BotSaveActions> = {}): BotSaveActions => ({
    createBot: jest.fn(),
    patchBot: jest.fn().mockResolvedValue({data: TestHelper.getBotMock({user_id: 'bot-user-id'})}),
    uploadProfileImage: jest.fn().mockResolvedValue({data: true}),
    setDefaultProfileImage: jest.fn().mockResolvedValue({data: true}),
    createUserAccessToken: jest.fn(),
    updateUserRoles: jest.fn().mockResolvedValue({data: true}),
    getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: []}),
    getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
    updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
    ...overrides,
});

const MEMBER = {isAdmin: false, postAll: false, postChannels: false};

describe('bot_save_flow', () => {
    describe('validateBotForm', () => {
        const base = {username: 'testbot', pictureFile: null, maxFileSize: 100, isCreate: true, expiryError: null};
        const image = (type: string, size: number) => new File(['x'.repeat(size)], 'icon', {type});

        test('a valid form passes', () => {
            expect(validateBotForm(base)).toBeUndefined();
        });

        test('a short username fails before the image is checked', () => {
            expect(validateBotForm({...base, username: 'ab', pictureFile: image('text/plain', 1)})).toEqual({kind: 'message', message: botSaveMessages.invalidUsername});
        });

        test('an unsupported image type fails', () => {
            expect(validateBotForm({...base, pictureFile: image('text/plain', 1)})).toEqual({kind: 'message', message: botSaveMessages.invalidImage});
        });

        test('an image over the size limit fails', () => {
            expect(validateBotForm({...base, pictureFile: image('image/png', 101)})).toEqual({kind: 'message', message: botSaveMessages.imageTooLarge});
        });

        test('the expiry error is passed through before the bot username check', () => {
            expect(validateBotForm({...base, username: 'testbot.', expiryError: 'bad expiry'})).toEqual({kind: 'expiry', error: 'bad expiry'});
        });

        test('a trailing period fails on create only', () => {
            expect(validateBotForm({...base, username: 'testbot.'})).toEqual({kind: 'message', message: botSaveMessages.invalidLastChar});
            expect(validateBotForm({...base, username: 'testbot.', isCreate: false})).toBeUndefined();
        });
    });

    describe('loadBotAttributeValues', () => {
        test('fetches only what is needed and normalizes values', async () => {
            const actions = buildActions({getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {dept: 'Eng', cleared: null}})});

            await expect(loadBotAttributeValues(actions, {needFields: false, botUserId: 'bot-user-id'})).resolves.toEqual({dept: 'Eng'});
            expect(actions.getCustomProfileAttributeFields).not.toHaveBeenCalled();
            expect(actions.getCustomProfileAttributeValues).toHaveBeenCalledWith('bot-user-id');
        });

        test('create fetches fields only', async () => {
            const actions = buildActions();

            await expect(loadBotAttributeValues(actions, {needFields: true})).resolves.toEqual({});
            expect(actions.getCustomProfileAttributeFields).toHaveBeenCalledTimes(1);
            expect(actions.getCustomProfileAttributeValues).not.toHaveBeenCalled();
        });

        test('either failure returns undefined', async () => {
            await expect(loadBotAttributeValues(buildActions({getCustomProfileAttributeFields: jest.fn().mockResolvedValue({error: {}})}), {needFields: true})).resolves.toBeUndefined();
            await expect(loadBotAttributeValues(buildActions({getCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {}})}), {needFields: false, botUserId: 'id'})).resolves.toBeUndefined();
        });
    });

    describe('saveBotEdit', () => {
        const base = {
            botUserId: 'bot-user-id',
            patch: {username: 'testbot'},
            pictureFile: null,
            currentRoles: 'system_user',
            roleChoice: MEMBER,
            canManageRoles: true,
            attributeChanges: {},
        };

        test('an image failure is reported with context and later steps still run', async () => {
            const actions = buildActions({uploadProfileImage: jest.fn().mockResolvedValue({error: {message: 'Too big'}})});

            const result = await saveBotEdit(actions, {...base, pictureFile: new File(['x'], 'icon', {type: 'image/png'}), roleChoice: {...MEMBER, isAdmin: true}, attributeChanges: {dept: 'Eng'}});

            expect(result).toEqual({ok: true, failures: [{key: 'image', message: botSaveMessages.imageFailed, error: 'Too big'}], savedAttributes: {dept: 'Eng'}});
            expect(actions.updateUserRoles).toHaveBeenCalledWith('bot-user-id', 'system_user system_admin');
        });

        test('unknown current roles skip the role update', async () => {
            const actions = buildActions();

            await saveBotEdit(actions, {...base, currentRoles: undefined, roleChoice: {...MEMBER, isAdmin: true}});

            expect(actions.updateUserRoles).not.toHaveBeenCalled();
        });

        test('a failed attributes save is not reported as saved', async () => {
            const actions = buildActions({updateUserCustomProfileAttributeValues: jest.fn().mockResolvedValue({error: {message: 'Nope'}})});

            const result = await saveBotEdit(actions, {...base, attributeChanges: {dept: 'Eng'}});

            expect(result).toEqual({ok: true, failures: [{key: 'attributes', message: botSaveMessages.attributesFailed, error: 'Nope'}], savedAttributes: undefined});
        });

        test('a patch failure stops immediately', async () => {
            const actions = buildActions({patchBot: jest.fn().mockResolvedValue({error: {message: 'Patch failed'}})});

            await expect(saveBotEdit(actions, {...base, attributeChanges: {dept: 'Eng'}})).resolves.toEqual({ok: false, error: 'Patch failed'});
            expect(actions.updateUserCustomProfileAttributeValues).not.toHaveBeenCalled();
        });
    });
});

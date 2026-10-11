// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {Bot, BotPatch} from '@mattermost/types/bots';
import type {UserAccessToken} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';
import type {ActionResult} from 'mattermost-redux/types/actions';

import type {UserAttributeValue} from 'components/property_fields/user_attribute_fields';

import {AcceptedProfileImageTypes, ValidationErrors} from 'utils/constants';
import * as Utils from 'utils/utils';

import {computeBotRoles, getBotCreateRedirectUrl, normalizeAttributeValues, rolesChanged} from './bot_attributes';
import type {BotAttributeValues, BotRoleChoice} from './bot_attributes';

export type BotSaveActions = {

    /**
     * Creates a new bot account.
     */
    createBot: (bot: Partial<Bot>) => Promise<ActionResult<Bot>>;

    /**
     * Patches an existing bot account.
     */
    patchBot: (botUserId: string, botPatch: Partial<BotPatch>) => Promise<ActionResult<Bot>>;

    /**
     * Uploads a user profile image
     */
    uploadProfileImage: (userId: string, image: File | string) => Promise<ActionResult>;

    /**
     * Set profile image to default
     */
    setDefaultProfileImage: (userId: string) => Promise<ActionResult>;

    /**
     * For creating default access token
     */
    createUserAccessToken: (userId: string, description: string, expiresAt?: number) => Promise<ActionResult<UserAccessToken>>;

    /**
     * For creating setting bot to system admin or special posting permissions
     */
    updateUserRoles: (userId: string, roles: string) => Promise<ActionResult>;

    getCustomProfileAttributeFields: () => Promise<ActionResult>;
    getCustomProfileAttributeValues: (userID: string) => Promise<ActionResult<Record<string, string>>>;
    updateUserCustomProfileAttributeValues: (userID: string, values: Record<string, string | string[]>) => Promise<ActionResult<Record<string, string | string[]>>>;
};

export type BotPictureFile = File | null | string;

export const botSaveMessages = defineMessages({
    invalidUsername: {
        id: 'bots.manage.add.invalid_username',
        defaultMessage: 'Usernames have to begin with a lowercase letter and be 3-22 characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.',
    },
    invalidLastChar: {
        id: 'bots.manage.add.invalid_last_char',
        defaultMessage: 'Bot usernames cannot have a period as the last character',
    },
    invalidImage: {
        id: 'user.settings.general.validImage',
        defaultMessage: 'Only BMP, JPG or PNG images may be used for profile pictures',
    },
    imageTooLarge: {
        id: 'user.settings.general.imageTooLarge',
        defaultMessage: 'Unable to upload profile image. File is too large.',
    },
    imageFailed: {
        id: 'bots.manage.edit.image_failed',
        defaultMessage: 'The bot was updated, but its profile image could not be saved. {error}',
    },
    rolesFailed: {
        id: 'bots.manage.edit.roles_failed',
        defaultMessage: 'The bot was updated, but its role and post permissions could not be saved. {error}',
    },
    attributesFailed: {
        id: 'bots.manage.edit.attributes_failed',
        defaultMessage: 'The bot was updated, but its attributes could not be saved. {error}',
    },
});

function isFile(file: File | string): file is File {
    return (file as File).size !== undefined;
}

export async function loadBotAttributeValues(
    actions: Pick<BotSaveActions, 'getCustomProfileAttributeFields' | 'getCustomProfileAttributeValues'>,
    {needFields, botUserId}: {needFields: boolean; botUserId?: string},
): Promise<BotAttributeValues | undefined> {
    const [fieldsResult, valuesResult] = await Promise.all([
        needFields ? actions.getCustomProfileAttributeFields() : Promise.resolve<ActionResult>({data: true}),
        botUserId ? actions.getCustomProfileAttributeValues(botUserId) : Promise.resolve<ActionResult<Record<string, string>>>({data: {}}),
    ]);
    if (!fieldsResult || fieldsResult.error || !valuesResult || valuesResult.error) {
        return undefined;
    }
    return normalizeAttributeValues(valuesResult.data);
}

export type BotFormError<T> = {kind: 'message'; message: MessageDescriptor} | {kind: 'expiry'; error: T};

export function validateBotForm<T>({username, pictureFile, maxFileSize, isCreate, expiryError}: {
    username: string;
    pictureFile: BotPictureFile;
    maxFileSize: number;
    isCreate: boolean;
    expiryError: T | null | undefined;
}): BotFormError<T> | undefined {
    if (!username || username.length < 3) {
        return {kind: 'message', message: botSaveMessages.invalidUsername};
    }

    if (pictureFile && isFile(pictureFile)) {
        if (!AcceptedProfileImageTypes.includes(pictureFile.type)) {
            return {kind: 'message', message: botSaveMessages.invalidImage};
        } else if (pictureFile.size > maxFileSize) {
            return {kind: 'message', message: botSaveMessages.imageTooLarge};
        }
    }

    if (expiryError) {
        return {kind: 'expiry', error: expiryError};
    }

    if (isCreate) {
        const usernameError = Utils.isValidBotUsername(username.toLowerCase().trim());
        if (usernameError) {
            const message = usernameError.id === ValidationErrors.INVALID_LAST_CHARACTER ? botSaveMessages.invalidLastChar : botSaveMessages.invalidUsername;
            return {kind: 'message', message};
        }
    }

    return undefined;
}

type BotSaveInput = {
    pictureFile: BotPictureFile;
    roleChoice: BotRoleChoice;
    canManageRoles: boolean;
    attributeChanges: Record<string, UserAttributeValue>;
};

export type BotSaveFailure = {key: 'image' | 'roles' | 'attributes'; message: MessageDescriptor; error: string};

export type BotEditResult = {ok: false; error: string} | {ok: true; failures: BotSaveFailure[]; savedAttributes?: Record<string, UserAttributeValue>};

export async function saveBotEdit(actions: BotSaveActions, input: BotSaveInput & {
    botUserId: string;
    patch: Partial<BotPatch>;

    /** Undefined when the bot user's roles weren't known at mount; roles are then left alone. */
    currentRoles: string | undefined;
}): Promise<BotEditResult> {
    const result = await actions.patchBot(input.botUserId, input.patch);
    const data = result?.data;
    if (!data) {
        return {ok: false, error: result?.error?.message ?? Utils.localizeMessage({id: 'bot.edit_failed', defaultMessage: 'Failed to edit bot'})};
    }

    const failures: BotSaveFailure[] = [];

    if (input.pictureFile && input.pictureFile !== 'default') {
        const imageResult = await actions.uploadProfileImage(data.user_id, input.pictureFile);
        if (imageResult?.error) {
            failures.push({key: 'image', message: botSaveMessages.imageFailed, error: imageResult.error.message ?? ''});
        }
    } else if (input.pictureFile === 'default') {
        await actions.setDefaultProfileImage(data.user_id);
    }

    if (input.canManageRoles && input.currentRoles !== undefined) {
        const nextRoles = computeBotRoles(input.currentRoles, input.roleChoice);
        if (rolesChanged(input.currentRoles, nextRoles)) {
            const rolesResult = await actions.updateUserRoles(data.user_id, nextRoles);
            if (!rolesResult || rolesResult.error) {
                failures.push({key: 'roles', message: botSaveMessages.rolesFailed, error: rolesResult?.error?.message ?? ''});
            }
        }
    }

    let savedAttributes: Record<string, UserAttributeValue> | undefined;
    if (Object.keys(input.attributeChanges).length > 0) {
        const attributesResult = await actions.updateUserCustomProfileAttributeValues(data.user_id, input.attributeChanges);
        if (!attributesResult || attributesResult.error) {
            failures.push({key: 'attributes', message: botSaveMessages.attributesFailed, error: attributesResult?.error?.message ?? ''});
        } else {
            savedAttributes = input.attributeChanges;
        }
    }

    return {ok: true, failures, savedAttributes};
}

export type BotCreateResult = {ok: false; error: string} | {ok: true; redirectUrl: string};

export async function saveBotCreate(actions: BotSaveActions, input: BotSaveInput & {
    bot: Partial<Bot>;
    teamName: string;
    expiresAt: number;
}): Promise<BotCreateResult> {
    const result = await actions.createBot(input.bot);
    const data = result?.data;
    if (!data) {
        return {ok: false, error: result?.error?.message ?? Utils.localizeMessage({id: 'bot.create_failed', defaultMessage: 'Failed to create bot'})};
    }

    if (input.pictureFile && input.pictureFile !== 'default') {
        await actions.uploadProfileImage(data.user_id, input.pictureFile);
    } else {
        await actions.setDefaultProfileImage(data.user_id);
    }

    const tokenResult = await actions.createUserAccessToken(
        data.user_id,
        Utils.localizeMessage({id: 'bot.token.default.description', defaultMessage: 'Default Token'}),
        input.expiresAt > 0 ? input.expiresAt : undefined,
    );
    const token = tokenResult && !tokenResult.error ? tokenResult.data?.token : undefined;

    let rolesFailed = false;
    if (input.canManageRoles) {
        const nextRoles = computeBotRoles(General.SYSTEM_USER_ROLE, input.roleChoice);
        if (rolesChanged(General.SYSTEM_USER_ROLE, nextRoles)) {
            const rolesResult = await actions.updateUserRoles(data.user_id, nextRoles);
            rolesFailed = !rolesResult || Boolean(rolesResult.error);
        }
    }

    let attributesFailed = false;
    if (Object.keys(input.attributeChanges).length > 0) {
        const attributesResult = await actions.updateUserCustomProfileAttributeValues(data.user_id, input.attributeChanges);
        attributesFailed = !attributesResult || Boolean(attributesResult.error);
    }

    return {ok: true, redirectUrl: getBotCreateRedirectUrl(input.teamName, data.user_id, token, {rolesFailed, attributesFailed})};
}

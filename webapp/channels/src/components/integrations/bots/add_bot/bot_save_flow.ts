// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {Bot, BotEventSubscription, BotEventSubscriptionPatch, BotPatch} from '@mattermost/types/bots';
import type {UserAccessToken} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {AcceptedProfileImageTypes, ValidationErrors} from 'utils/constants';
import * as Utils from 'utils/utils';

import {computeBotRoles, getBotCreateRedirectUrl, normalizeAttributeValues, rolesChanged} from './bot_attributes';
import type {BotAttributeValues, BotRoleUpdate} from './bot_attributes';
import type {EventDeliveryChange} from './bot_event_delivery';

export type BotSaveActions = {

    /**
     * Creates a new bot account.
     */
    createBot: (bot: Partial<Bot>) => Promise<ActionResult<Bot>>;

    /**
     * Creates a new bot account together with its event subscription, rolling back both on failure.
     */
    createBotWithEventSubscription: (bot: Partial<Bot>, eventSubscription: BotEventSubscriptionPatch) => Promise<ActionResult<{bot: Bot; eventSubscription: BotEventSubscription}>>;

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

    getBotEventSubscription: (botUserId: string) => Promise<ActionResult<BotEventSubscription | null>>;
    upsertBotEventSubscription: (botUserId: string, patch: BotEventSubscriptionPatch) => Promise<ActionResult<BotEventSubscription>>;
    deleteBotEventSubscription: (botUserId: string) => Promise<ActionResult>;

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
    eventDeliveryFailed: {
        id: 'bots.manage.edit.event_delivery_failed',
        defaultMessage: 'The bot was updated, but its event delivery settings could not be saved. {error}',
    },
});

function isFile(file: File | string): file is File {
    return (file as File).size !== undefined;
}

export async function loadBotAttributeValues(
    actions: Pick<BotSaveActions, 'getCustomProfileAttributeFields' | 'getCustomProfileAttributeValues'>,
    botUserId: string | undefined,
): Promise<BotAttributeValues | undefined> {
    const [fieldsResult, valuesResult] = await Promise.all([
        actions.getCustomProfileAttributeFields(),
        botUserId ? actions.getCustomProfileAttributeValues(botUserId) : undefined,
    ]);
    if (!fieldsResult || fieldsResult.error || valuesResult?.error) {
        return undefined;
    }
    return normalizeAttributeValues(valuesResult?.data);
}

export function validateBotForm({username, pictureFile, maxFileSize, isCreate}: {
    username: string;
    pictureFile: BotPictureFile;
    maxFileSize: number;
    isCreate: boolean;
}): MessageDescriptor | undefined {
    if (!username || username.length < 3) {
        return botSaveMessages.invalidUsername;
    }

    if (pictureFile && isFile(pictureFile)) {
        if (!AcceptedProfileImageTypes.includes(pictureFile.type)) {
            return botSaveMessages.invalidImage;
        } else if (pictureFile.size > maxFileSize) {
            return botSaveMessages.imageTooLarge;
        }
    }

    if (isCreate) {
        const usernameError = Utils.isValidBotUsername(username.toLowerCase().trim());
        if (usernameError) {
            return usernameError.id === ValidationErrors.INVALID_LAST_CHARACTER ? botSaveMessages.invalidLastChar : botSaveMessages.invalidUsername;
        }
    }

    return undefined;
}

type BotSaveInput = {
    pictureFile: BotPictureFile;

    /** Omitted when the caller may not change the bot's roles, or they aren't known. */
    roleUpdate?: BotRoleUpdate;
    attributeChanges: BotAttributeValues;
};

type BotSaveStep = 'image' | 'roles' | 'attributes' | 'eventDelivery';
type BotSaveStepErrors = Partial<Record<BotSaveStep, string>>;

const BOT_SAVE_STEPS: BotSaveStep[] = ['image', 'roles', 'attributes', 'eventDelivery'];

function stepError(result: ActionResult | undefined): string | undefined {
    if (result && !result.error) {
        return undefined;
    }
    return result?.error?.message ?? '';
}

async function saveBotDetails(actions: BotSaveActions, userId: string, input: BotSaveInput): Promise<BotSaveStepErrors> {
    const errors: BotSaveStepErrors = {};

    if (input.pictureFile === 'default') {
        errors.image = stepError(await actions.setDefaultProfileImage(userId));
    } else if (input.pictureFile) {
        errors.image = stepError(await actions.uploadProfileImage(userId, input.pictureFile));
    }

    if (input.roleUpdate) {
        const {currentRoles, choice} = input.roleUpdate;
        const nextRoles = computeBotRoles(currentRoles, choice);
        if (rolesChanged(currentRoles, nextRoles)) {
            errors.roles = stepError(await actions.updateUserRoles(userId, nextRoles));
        }
    }

    if (Object.keys(input.attributeChanges).length > 0) {
        errors.attributes = stepError(await actions.updateUserCustomProfileAttributeValues(userId, input.attributeChanges));
    }

    return errors;
}

export type BotSaveFailure = {key: BotSaveStep; message: MessageDescriptor; error: string};

export type BotEditResult = {ok: false; error: string} | {ok: true; failures: BotSaveFailure[]; savedAttributes: BotAttributeValues; eventSecret?: string};

async function saveEventDelivery(actions: BotSaveActions, userId: string, change: EventDeliveryChange): Promise<{error?: string; secret?: string}> {
    switch (change.kind) {
    case 'none':
        return {};
    case 'delete':
        return {error: stepError(await actions.deleteBotEventSubscription(userId))};
    case 'upsert': {
        const result = await actions.upsertBotEventSubscription(userId, change.patch);
        return {error: stepError(result), secret: result?.data?.secret};
    }
    default: {
        const unhandled: never = change;
        throw new Error(`Unhandled event delivery change: ${JSON.stringify(unhandled)}`);
    }
    }
}

export async function saveBotEdit(actions: BotSaveActions, input: BotSaveInput & {
    botUserId: string;
    patch: Partial<BotPatch>;
    eventDelivery: EventDeliveryChange;
}): Promise<BotEditResult> {
    const result = await actions.patchBot(input.botUserId, input.patch);
    const data = result?.data;
    if (!data) {
        return {ok: false, error: result?.error?.message ?? Utils.localizeMessage({id: 'bot.edit_failed', defaultMessage: 'Failed to edit bot'})};
    }

    const errors = await saveBotDetails(actions, data.user_id, input);
    const eventDelivery = await saveEventDelivery(actions, data.user_id, input.eventDelivery);
    errors.eventDelivery = eventDelivery.error;
    const failures = BOT_SAVE_STEPS.flatMap((key) => {
        const error = errors[key];
        return error === undefined ? [] : [{key, message: botSaveMessages[`${key}Failed` as const], error}];
    });

    return {ok: true, failures, savedAttributes: errors.attributes === undefined ? input.attributeChanges : {}, eventSecret: eventDelivery.secret};
}

export type BotCreateResult = {ok: false; error: string} | {ok: true; redirectUrl: string};

export async function saveBotCreate(actions: BotSaveActions, input: BotSaveInput & {
    bot: Partial<Bot>;
    teamName: string;
    expiresAt: number;
    eventSubscription?: BotEventSubscriptionPatch;
}): Promise<BotCreateResult> {
    let created: Bot | undefined;
    let secret: string | undefined;
    let createError: string | undefined;
    if (input.eventSubscription) {
        const result = await actions.createBotWithEventSubscription(input.bot, input.eventSubscription);
        created = result?.data?.bot;
        secret = result?.data?.eventSubscription.secret;
        createError = result?.error?.message;
    } else {
        const result = await actions.createBot(input.bot);
        created = result?.data;
        createError = result?.error?.message;
    }
    if (!created) {
        return {ok: false, error: createError ?? Utils.localizeMessage({id: 'bot.create_failed', defaultMessage: 'Failed to create bot'})};
    }

    const tokenResult = await actions.createUserAccessToken(
        created.user_id,
        Utils.localizeMessage({id: 'bot.token.default.description', defaultMessage: 'Default Token'}),
        input.expiresAt > 0 ? input.expiresAt : undefined,
    );
    const token = tokenResult && !tokenResult.error ? tokenResult.data?.token : undefined;

    // Only an explicit reset to the default icon reports a failure.
    if (!input.pictureFile) {
        await actions.setDefaultProfileImage(created.user_id);
    }
    const errors = await saveBotDetails(actions, created.user_id, input);

    return {
        ok: true,
        redirectUrl: getBotCreateRedirectUrl(input.teamName, created.user_id, token, {
            imageFailed: errors.image !== undefined,
            rolesFailed: errors.roles !== undefined,
            attributesFailed: errors.attributes !== undefined,
        }, secret),
    };
}

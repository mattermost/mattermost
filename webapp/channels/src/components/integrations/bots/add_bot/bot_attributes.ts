// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';

import type {Bot} from '@mattermost/types/bots';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {General} from 'mattermost-redux/constants';
import {isPropertyFieldRequired} from 'mattermost-redux/utils/property_utils';

import {BOT_CREATE_WARNINGS_PARAM, serializeBotCreateWarnings} from 'components/integrations/bots/bot_create_warnings';
import type {BotCreateWarnings} from 'components/integrations/bots/bot_create_warnings';
import {
    canEditUserAttribute,
    getEmptyUserAttributeValue,
    getVisibleUserAttributeFields,
    hasUserAttributeValue,
    isSameUserAttributeValue,
    validateUserAttributeValue,
} from 'components/property_fields/user_attribute_fields';
import type {UserAttributeLockOptions, UserAttributeValue} from 'components/property_fields/user_attribute_fields';

export type BotAttributesStatus = 'loading' | 'ready' | 'error';
export type BotAttributeValues = Record<string, UserAttributeValue>;
export type BotRoleChoice = {isAdmin: boolean; postAll: boolean; postChannels: boolean};
export type BotRoleUpdate = {currentRoles: string; choice: BotRoleChoice};

export type BotAttributesState = {
    status: BotAttributesStatus;
    rows: string[];
    values: BotAttributeValues;
    initialValues: BotAttributeValues;
    errors: Record<string, MessageDescriptor | undefined>;
};

const MANAGED_ROLES = [General.SYSTEM_USER_ROLE, General.SYSTEM_ADMIN_ROLE, General.SYSTEM_POST_ALL_ROLE, General.SYSTEM_POST_ALL_PUBLIC_ROLE];

export function canManageBotAttributes(
    bot: Pick<Bot, 'owner_id'> | undefined,
    currentUserId: string,
    perms: {manageBots: boolean; manageOthersBots: boolean},
): boolean {
    if (!bot || bot.owner_id === currentUserId) {
        return perms.manageBots;
    }
    return perms.manageOthersBots;
}

function isUserAttributeValue(value: unknown): value is UserAttributeValue {
    if (typeof value === 'string') {
        return true;
    }
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function normalizeAttributeValues(raw: Record<string, unknown> | undefined): BotAttributeValues {
    const values: BotAttributeValues = {};
    if (!raw) {
        return values;
    }
    for (const [id, value] of Object.entries(raw)) {
        if (isUserAttributeValue(value) && hasUserAttributeValue(value)) {
            values[id] = value;
        }
    }
    return values;
}

export function emptyAttributesState(status: BotAttributesStatus): BotAttributesState {
    return {status, rows: [], values: {}, initialValues: {}, errors: {}};
}

export function loadedAttributesState(initialValues: BotAttributeValues): BotAttributesState {
    return {
        status: 'ready',
        rows: Object.keys(initialValues).filter((id) => hasUserAttributeValue(initialValues[id])),
        values: {...initialValues},
        initialValues,
        errors: {},
    };
}

export function addAttributeRow(state: BotAttributesState, field: UserPropertyField): BotAttributesState {
    return {
        ...state,
        rows: state.rows.includes(field.id) ? state.rows : [...state.rows, field.id],
        values: {...state.values, [field.id]: getEmptyUserAttributeValue(field)},
        errors: {...state.errors, [field.id]: undefined},
    };
}

export function removeAttributeRow(state: BotAttributesState, fieldId: string): BotAttributesState {
    return {
        ...state,
        rows: state.rows.filter((id) => id !== fieldId),
        errors: {...state.errors, [fieldId]: undefined},
    };
}

export function setAttributeValue(state: BotAttributesState, fieldId: string, value: UserAttributeValue): BotAttributesState {
    return {
        ...state,
        values: {...state.values, [fieldId]: value},
        errors: {...state.errors, [fieldId]: undefined},
    };
}

export function markAttributesSaved(state: BotAttributesState, saved: BotAttributeValues): BotAttributesState {
    return {...state, initialValues: normalizeAttributeValues({...state.initialValues, ...saved})};
}

export function getRowFields(fields: UserPropertyField[], rows: string[]): UserPropertyField[] {
    return getVisibleUserAttributeFields(fields).filter((field) => rows.includes(field.id));
}

export function getAddableFields(fields: UserPropertyField[], rows: string[], opts: UserAttributeLockOptions): UserPropertyField[] {
    return getVisibleUserAttributeFields(fields).filter((field) => !rows.includes(field.id) && canEditUserAttribute(field, opts));
}

export function isRowRemovable(field: UserPropertyField, initialValues: BotAttributeValues): boolean {
    return !(isPropertyFieldRequired(field) && hasUserAttributeValue(initialValues[field.id]));
}

export function computeAttributeChanges(
    fields: UserPropertyField[],
    {rows, values, initialValues}: BotAttributesState,
    opts: UserAttributeLockOptions,
): BotAttributeValues {
    const changes: BotAttributeValues = {};
    for (const field of getVisibleUserAttributeFields(fields)) {
        if (!canEditUserAttribute(field, opts)) {
            continue;
        }
        const inRows = rows.includes(field.id);
        if (!inRows && !hasUserAttributeValue(initialValues[field.id])) {
            continue;
        }
        const next = inRows ? (values[field.id] ?? getEmptyUserAttributeValue(field)) : getEmptyUserAttributeValue(field);
        if (!isSameUserAttributeValue(next, initialValues[field.id])) {
            changes[field.id] = next;
        }
    }
    return changes;
}

export function validateAttributeRows(
    fields: UserPropertyField[],
    {rows, values, initialValues}: BotAttributesState,
    opts: UserAttributeLockOptions,
): Record<string, MessageDescriptor> {
    const errors: Record<string, MessageDescriptor> = {};
    for (const field of getRowFields(fields, rows)) {
        if (!canEditUserAttribute(field, opts)) {
            continue;
        }
        const value = values[field.id];
        const changed = !isSameUserAttributeValue(value, initialValues[field.id]);
        if (changed || (isPropertyFieldRequired(field) && !hasUserAttributeValue(value))) {
            const error = validateUserAttributeValue(field, value);
            if (error) {
                errors[field.id] = error;
            }
        }
    }
    return errors;
}

function splitRoles(roles: string): string[] {
    return roles.split(' ').filter(Boolean);
}

export function computeBotRoles(currentRoles: string, choice: BotRoleChoice): string {
    const rest = [...new Set(splitRoles(currentRoles).filter((role) => !MANAGED_ROLES.includes(role)))];

    let extra: string | undefined;
    if (choice.isAdmin) {
        extra = General.SYSTEM_ADMIN_ROLE;
    } else if (choice.postAll) {
        extra = General.SYSTEM_POST_ALL_ROLE;
    } else if (choice.postChannels) {
        extra = General.SYSTEM_POST_ALL_PUBLIC_ROLE;
    }

    return [General.SYSTEM_USER_ROLE, ...rest, ...(extra ? [extra] : [])].join(' ');
}

export function rolesChanged(currentRoles: string, nextRoles: string): boolean {
    const current = new Set(splitRoles(currentRoles));
    const next = new Set(splitRoles(nextRoles));
    return current.size !== next.size || [...current].some((role) => !next.has(role));
}

export function getBotCreateRedirectUrl(
    teamName: string,
    botUserId: string,
    token: string | undefined,
    warnings: Omit<BotCreateWarnings, 'tokenFailed'>,
): string {
    const serialized = serializeBotCreateWarnings({...warnings, tokenFailed: !token});
    const param = serialized ? `${BOT_CREATE_WARNINGS_PARAM}=${serialized}` : '';

    if (!token) {
        return `/${teamName}/integrations/bots${param ? `?${param}` : ''}`;
    }
    return `/${teamName}/integrations/confirm?type=bots&id=${botUserId}${param ? `&${param}` : ''}`;
}

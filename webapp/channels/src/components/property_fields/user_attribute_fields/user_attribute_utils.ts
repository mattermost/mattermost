// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {isEmail} from 'mattermost-redux/utils/helpers';
import {isPropertyFieldRequired, isPropertyFieldSourceManaged, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import {validHttpUrl} from 'utils/url';

export type UserAttributeValue = string | string[];

export type UserAttributeLockOptions = {canEditAdminManaged: boolean};

const messages = defineMessages({
    required: {
        id: 'property_fields.user_attribute_fields.required',
        defaultMessage: 'This attribute is required.',
    },
    invalidEmail: {
        id: 'admin.user_item.invalidEmail',
        defaultMessage: 'Invalid email address',
    },
    invalidUrl: {
        id: 'admin.user_item.invalidUrl',
        defaultMessage: 'Invalid URL',
    },
});

export function isAdminManagedLocked(field: UserPropertyField, {canEditAdminManaged}: UserAttributeLockOptions): boolean {
    return field.attrs?.managed === 'admin' && !canEditAdminManaged;
}

export function canEditUserAttribute(field: UserPropertyField, opts: UserAttributeLockOptions): boolean {
    if (isPropertyFieldSourceManaged(field) || isAdminManagedLocked(field, opts)) {
        return false;
    }
    if (field.attrs?.options_omitted && field.type !== 'graph') {
        return false;
    }

    // The server rejects the whole save if any field fails this tier. User fields
    // target the system, so admin resolves to manage_system and empty defaults to member.
    const level = field.permission_values ?? '';
    switch (level) {
    case 'none':
    case 'creator':
        // creator is the author of the entity an action concerns; a user attribute
        // has no such author, so no one is granted the edit through it.
        return false;
    case 'sysadmin':
    case 'admin':
        return opts.canEditAdminManaged;
    case 'member':
    case '':
        return true;
    default: {
        const unhandled: never = level;
        return unhandled;
    }
    }
}

export function hasUserAttributeValue(value: UserAttributeValue | undefined): boolean {
    return isPropertyValueSet(value);
}

export function validateUserAttributeValue(field: UserPropertyField, value: UserAttributeValue | undefined): MessageDescriptor | undefined {
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (!hasUserAttributeValue(normalized)) {
        return isPropertyFieldRequired(field) ? messages.required : undefined;
    }
    if (typeof normalized !== 'string') {
        return undefined;
    }
    const valueType = field.attrs?.value_type;
    if (valueType === 'email' && !isEmail(normalized)) {
        return messages.invalidEmail;
    }
    if (valueType === 'url' && validHttpUrl(normalized) === null) {
        return messages.invalidUrl;
    }
    return undefined;
}

export function getVisibleUserAttributeFields(fields: UserPropertyField[]): UserPropertyField[] {
    return fields.
        filter((field) => field.attrs?.access_mode !== 'source_only').
        sort((a, b) => (a.attrs?.sort_order || 0) - (b.attrs?.sort_order || 0));
}

export function isSameUserAttributeValue(a?: UserAttributeValue, b?: UserAttributeValue): boolean {
    if (!hasUserAttributeValue(a) && !hasUserAttributeValue(b)) {
        return true;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) &&
            a.length === b.length &&
            a.every((item, index) => item === b[index]);
    }
    return a === b;
}

export function getEmptyUserAttributeValue(field: UserPropertyField): UserAttributeValue {
    switch (field.type) {
    case 'text':
    case 'select':
    case 'rank':
    case 'date':
    case 'user':
        return '';
    case 'multiselect':
    case 'graph':
    case 'multiuser':
        return [];
    default: {
        const unhandled: never = field.type;
        return unhandled;
    }
    }
}

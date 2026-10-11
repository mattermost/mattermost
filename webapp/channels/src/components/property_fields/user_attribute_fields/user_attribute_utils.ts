// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';
import {isEmail} from 'mattermost-redux/utils/helpers';
import {isPropertyFieldRequired, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import {validHttpUrl} from 'utils/url';

export type UserAttributeValue = string | string[];

export type UserAttributeLockReason = 'protected' | 'synced' | 'owner_managed' | 'options_omitted' | 'admin_managed';

export type UserAttributeLockOptions = {canEditAdminManaged: boolean};

const messages = defineMessages({
    required: {
        id: 'property_fields.user_attribute_fields.required',
        defaultMessage: 'This attribute is required.',
    },
    tooLong: {
        id: 'property_fields.user_attribute_fields.too_long',
        defaultMessage: 'This value is too long.',
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

// Matches the server lock order; synced means any ldap/saml attr regardless of the target's auth_service.
export function getUserAttributeLockReason(field: UserPropertyField, {canEditAdminManaged}: UserAttributeLockOptions): UserAttributeLockReason | undefined {
    const attrs = field.attrs;
    if (attrs?.protected) {
        return 'protected';
    }
    if (attrs?.ldap || attrs?.saml) {
        return 'synced';
    }
    if (attrs?.owners?.length) {
        return 'owner_managed';
    }
    if (attrs?.options_omitted && field.type !== 'graph') {
        return 'options_omitted';
    }
    if (attrs?.managed === 'admin' && !canEditAdminManaged) {
        return 'admin_managed';
    }
    return undefined;
}

export function canEditUserAttribute(field: UserPropertyField, opts: UserAttributeLockOptions): boolean {
    return getUserAttributeLockReason(field, opts) === undefined;
}

export function hasUserAttributeValue(value: UserAttributeValue | undefined): boolean {
    return isPropertyValueSet(value);
}

// The server measures bytes, and TextEncoder is unavailable in the jest jsdom environment.
function getUtf8ByteLength(value: string): number {
    let bytes = 0;
    for (const char of value) {
        const codePoint = char.codePointAt(0) ?? 0;
        if (codePoint <= 0x7f) {
            bytes += 1;
        } else if (codePoint <= 0x7ff) {
            bytes += 2;
        } else if (codePoint <= 0xffff) {
            bytes += 3;
        } else {
            bytes += 4;
        }
    }
    return bytes;
}

export function validateUserAttributeValue(field: UserPropertyField, value: UserAttributeValue | undefined): MessageDescriptor | undefined {
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (!hasUserAttributeValue(normalized)) {
        return isPropertyFieldRequired(field) ? messages.required : undefined;
    }
    if (typeof normalized !== 'string') {
        return undefined;
    }
    if (field.type === 'text' && getUtf8ByteLength(normalized) > PROPERTY_TEXT_VALUE_MAX_LENGTH) {
        return messages.tooLong;
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

export function getClearedUserAttributeValue(field: UserPropertyField): UserAttributeValue {
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

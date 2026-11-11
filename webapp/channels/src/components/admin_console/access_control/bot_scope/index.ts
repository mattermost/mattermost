// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {referencedNativeUserAttributeNames, referencedUserAttributeNames} from '../cel_lexer';

export const SYSTEM_BOT_ROLE = 'system_bot';

// Native built-ins every bot either lacks or shares, so they can't scope a bot policy.
export const BOT_SCOPE_HIDDEN_NATIVE: string[] = ['email', 'verified', 'isbot'];

export function getSyncedAttributeReferences(expr: string, userFields: UserPropertyField[]): UserPropertyField[] {
    const names = new Set(referencedUserAttributeNames(expr));
    return userFields.filter((field) => names.has(field.name) && Boolean(field.attrs?.ldap || field.attrs?.saml));
}

export function getHiddenNativeReferences(expr: string): string[] {
    const names = new Set(referencedNativeUserAttributeNames(expr));
    return BOT_SCOPE_HIDDEN_NATIVE.filter((name) => names.has(name));
}

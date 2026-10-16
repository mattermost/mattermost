// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {findMatchingParen, referencedUserAttributeNames} from './lexer';

export {hasBalancedParens} from './lexer';

export const BOT_ROLE_KEY = 'bot';

export const BOT_SCOPE_PROP = 'bot_scope';

// Native built-ins every bot either lacks or shares, so they can't scope a bot policy.
export const BOT_SCOPE_HIDDEN_NATIVE: string[] = ['email', 'verified', 'isbot'];

// A Bot accounts policy is a system_user policy flagged with `props.bot_scope: true`
// whose rule is stored as `!user.isbot || (<E>\n)`. The server re-serializes on read
// but keeps this prefix first and verbatim for a well-formed `E`.
const BOT_SCOPE_PREFIX = '!user.isbot || ';

export function isBotScopePolicy(policy: Pick<AccessControlPolicy, 'props'>): boolean {
    return policy.props?.[BOT_SCOPE_PROP] === true;
}

export function toServerRole(key: string): string {
    return key === BOT_ROLE_KEY ? 'system_user' : key;
}

export function getPolicyRoleKey(policy: Pick<AccessControlPolicy, 'roles' | 'props'>): string | undefined {
    return isBotScopePolicy(policy) ? BOT_ROLE_KEY : policy.roles?.[0];
}

export function unwrapBotExpression(expr: string): string {
    if (!expr.startsWith(BOT_SCOPE_PREFIX)) {
        return expr;
    }

    let rest = expr;
    while (rest.startsWith(BOT_SCOPE_PREFIX)) {
        rest = rest.slice(BOT_SCOPE_PREFIX.length);
    }
    rest = rest.trim();

    if (rest.startsWith('(') && findMatchingParen(rest, 0) === rest.length - 1) {
        rest = rest.slice(1, -1).trim();
    }
    return rest;
}

// The newline keeps a trailing `// comment` in the expression from swallowing the `)`.
export function wrapBotExpression(expr: string): string {
    return `${BOT_SCOPE_PREFIX}(${expr}\n)`;
}

export function getSyncedAttributeReferences(expr: string, userFields: UserPropertyField[]): UserPropertyField[] {
    const names = new Set(referencedUserAttributeNames(expr));
    return userFields.filter((field) => names.has(field.name) && Boolean(field.attrs?.ldap || field.attrs?.saml));
}

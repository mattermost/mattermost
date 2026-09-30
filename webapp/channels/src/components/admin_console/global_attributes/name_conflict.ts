// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';
import {defineMessages} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import {findNameConflicts} from './utils';

/**
 * A live user field that shares an attribute's name without belonging to it,
 * paired with the template that owns it (absent when it is a standalone user
 * attribute).
 *
 * Only user fields, because the name an admin collides with is the one a CEL
 * rule spells as `user.attributes.<name>`.
 */
export type NameConflict = {
    field: PropertyField;
    ownerTemplate?: PropertyField;

    /**
     * Whether the names match exactly, not just ignoring case. The server's own
     * uniqueness check is case-sensitive, so only an exact match would make
     * applying the attribute to Users fail with a 409.
     */
    exact: boolean;
};

export function findNameConflict(
    name: string,
    userFields: PropertyField[],
    templates: PropertyField[],
    templateId?: string,
): NameConflict | undefined {
    const conflicts = findNameConflicts(name, userFields, templateId);
    if (conflicts.length === 0) {
        return undefined;
    }

    // The server's own uniqueness check is case-sensitive, so `Clearance` and
    // `clearance` can both exist as user fields. The exactly-matching one is the
    // one a create would collide with, so it wins over a merely confusing
    // case-only match -- otherwise whichever happened to be listed first would
    // decide whether Users is blocked.
    const field = conflicts.find((candidate) => candidate.name === name) ?? conflicts[0];

    return {
        field,
        ownerTemplate: templates.find((template) => template.id === field.linked_field_id),
        exact: field.name === name,
    };
}

export function nameConflictText(conflict: NameConflict, formatMessage: IntlShape['formatMessage']): string {
    return conflict.ownerTemplate ?
        formatMessage(messages.linkedToTemplate, {name: conflict.field.name, owner: getPropertyFieldLabel(conflict.ownerTemplate)}) :
        formatMessage(messages.standalone, {name: conflict.field.name});
}

export const messages = defineMessages({
    linkedToTemplate: {
        id: 'admin.global_attributes.name_conflict.linked_to_template',
        defaultMessage: 'A user attribute named "{name}" already exists and is linked to {owner}. Policies that use user.attributes.{name} read {owner}\'s options, not this attribute\'s.',
    },
    standalone: {
        id: 'admin.global_attributes.name_conflict.standalone',
        defaultMessage: 'A standalone user attribute named "{name}" already exists. Policies that use user.attributes.{name} read that attribute, not this one.',
    },
    usersBlocked: {
        id: 'admin.global_attributes.name_conflict.users_blocked',
        defaultMessage: 'Applying this attribute to Users would need a second user attribute named "{name}", which the server does not allow.',
    },
    usersBlockedMenuLabel: {
        id: 'admin.global_attributes.name_conflict.users_blocked_menu_label',
        defaultMessage: 'Name already in use',
    },
});

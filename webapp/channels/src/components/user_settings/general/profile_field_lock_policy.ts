// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LockProfileFieldsSetting} from '@mattermost/types/config';

export type ProfileField = 'firstName' | 'lastName' | 'username' | 'nickname' | 'position' | 'picture';
export type ProfileFieldLockState = 'editable' | 'fill_once' | 'locked';

type ProfileFieldLockPolicyOptions = {
    user: {
        auth_service: string;
        first_name: string;
        last_name: string;
    };
    canEditOtherUsers: boolean;
    lockProfileFieldsForEmailUsers: LockProfileFieldsSetting;
};

export type ProfileFieldLockPolicy = {
    fields: Readonly<Record<ProfileField, ProfileFieldLockState>>;
    allNameFieldsLocked: boolean;
    hasLockedNameField: boolean;
    isLocked: (field: ProfileField) => boolean;
};

const lockedFieldsBySetting: Record<LockProfileFieldsSetting, ReadonlySet<ProfileField>> = {
    none: new Set(),
    name_and_username: new Set(['firstName', 'lastName', 'username']),
    all: new Set(['firstName', 'lastName', 'username', 'nickname', 'position', 'picture']),
};

function getNameFieldState(isManaged: boolean, value: string): ProfileFieldLockState {
    if (!isManaged) {
        return 'editable';
    }

    return value ? 'locked' : 'fill_once';
}

export function createProfileFieldLockPolicy({
    user,
    canEditOtherUsers,
    lockProfileFieldsForEmailUsers,
}: ProfileFieldLockPolicyOptions): ProfileFieldLockPolicy {
    const isExempt = Boolean(user.auth_service) || canEditOtherUsers;
    const managedFields = lockedFieldsBySetting[isExempt ? 'none' : lockProfileFieldsForEmailUsers];
    const fields: Record<ProfileField, ProfileFieldLockState> = {
        firstName: getNameFieldState(managedFields.has('firstName'), user.first_name),
        lastName: getNameFieldState(managedFields.has('lastName'), user.last_name),
        username: managedFields.has('username') ? 'locked' : 'editable',
        nickname: managedFields.has('nickname') ? 'locked' : 'editable',
        position: managedFields.has('position') ? 'locked' : 'editable',
        picture: managedFields.has('picture') ? 'locked' : 'editable',
    };

    return {
        fields,
        allNameFieldsLocked: fields.firstName === 'locked' && fields.lastName === 'locked',
        hasLockedNameField: fields.firstName === 'locked' || fields.lastName === 'locked',
        isLocked: (field) => fields[field] === 'locked',
    };
}

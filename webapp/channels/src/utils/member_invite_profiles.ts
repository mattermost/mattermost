// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LockProfileFieldsSetting} from '@mattermost/types/config';
import type {MemberInviteProfile} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {isEmail} from 'mattermost-redux/utils/helpers';

import {Constants} from 'utils/constants';

type MemberInviteProfiles = Record<string, MemberInviteProfile>;

const normalizeEmail = (email: string) => email.toLowerCase();

export const emptyMemberInviteProfile = (email: string): MemberInviteProfile => ({
    email: normalizeEmail(email),
    username: '',
    first_name: '',
    last_name: '',
});

// Derives a profile from a first.last@domain email local-part. Anything else
// yields an empty profile for manual entry.
export const suggestMemberInviteProfile = (email: string): MemberInviteProfile => {
    const profile = emptyMemberInviteProfile(email);
    const match = (/^([a-z]+)\.([a-z]+)$/i).exec(email.split('@')[0]);
    if (match) {
        const capitalize = (part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        profile.first_name = capitalize(match[1]);
        profile.last_name = capitalize(match[2]);
        profile.username = `${match[1]}.${match[2]}`.toLowerCase();
    }
    return profile;
};

export const profileHasInput = (profile?: MemberInviteProfile): boolean => {
    return Boolean(profile && (profile.username || profile.first_name || profile.last_name));
};

export const getEmailsToPreset = (usersEmails: Array<UserProfile | string>): string[] => {
    return usersEmails.filter((userOrEmail): userOrEmail is string => typeof userOrEmail === 'string' && isEmail(userOrEmail));
};

export const canPresetMemberInviteProfiles = (emailInvitationsEnabled: boolean, lockProfileFields: LockProfileFieldsSetting): boolean => {
    return emailInvitationsEnabled && lockProfileFields !== Constants.LOCK_PROFILE_FIELDS.NONE;
};

export const getProfileForEmail = (profiles: MemberInviteProfiles | undefined, email: string): MemberInviteProfile | undefined => {
    return profiles?.[normalizeEmail(email)];
};

export const setProfileForEmail = (profiles: MemberInviteProfiles, email: string, profile: MemberInviteProfile): MemberInviteProfiles => {
    const normalizedEmail = normalizeEmail(email);
    return {
        ...profiles,
        [normalizedEmail]: {
            ...profile,
            email: normalizedEmail,
        },
    };
};

// Keeps only filled profiles belonging to the addresses being invited.
export const filterProfilesForEmails = (profiles: MemberInviteProfiles | undefined, emails: string[]): MemberInviteProfile[] => {
    if (!profiles) {
        return [];
    }

    const result: MemberInviteProfile[] = [];
    for (const email of emails) {
        const profile = getProfileForEmail(profiles, email);
        if (profile && profileHasInput(profile)) {
            result.push({...profile, email: normalizeEmail(email)});
        }
    }
    return result;
};

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import {getCustomProfileAttributeValues} from 'mattermost-redux/actions/users';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {isCallsPhoneDialingEnabled} from 'selectors/calls';

import {getUserPropertyFieldLabel} from 'utils/properties';

import type {GlobalState} from 'types/store';

export type DialablePhone = {
    fieldId: string;
    label: string;
    number: string;
};

const NO_FIELDS: UserPropertyField[] = [];

// getDialablePhones returns the phone numbers among a user's profile attributes, in attribute order,
// leaving out the ones the profile popover doesn't show either.
export function getDialablePhones(fields: UserPropertyField[], values: UserProfile['custom_profile_attributes']): DialablePhone[] {
    if (!values) {
        return [];
    }

    const phones: DialablePhone[] = [];
    for (const field of fields) {
        if (field.type !== 'text' || field.attrs?.value_type !== 'phone') {
            continue;
        }
        if (field.attrs?.visibility === 'hidden' || field.attrs?.access_mode === 'source_only') {
            continue;
        }

        const value = values[field.id];
        const number = typeof value === 'string' ? value.trim() : '';
        if (number) {
            phones.push({fieldId: field.id, label: getUserPropertyFieldLabel(field), number});
        }
    }
    return phones;
}

/**
 * Returns the numbers a call button can offer to phone this user on: empty unless the calls plugin
 * registered a phone action, outbound dialing is on, and the user can be called.
 */
export default function usePhoneCallOptions(userId: string | undefined, hasPhoneAction: boolean): DialablePhone[] {
    const dispatch = useDispatch();
    const dialingEnabled = useSelector((state: GlobalState) => hasPhoneAction && isCallsPhoneDialingEnabled(state));
    const user = useSelector((state: GlobalState) => (dialingEnabled && userId ? getUser(state, userId) : undefined));
    const active = Boolean(user) && !user?.is_bot && !user?.delete_at;
    const fields = useSelector((state: GlobalState) => (active ? getCustomProfileAttributes(state) : NO_FIELDS));
    const values = user?.custom_profile_attributes;

    useEffect(() => {
        if (active && userId && !values) {
            dispatch(getCustomProfileAttributeValues(userId));
        }
    }, [dispatch, active, userId, values]);

    return useMemo(() => (active ? getDialablePhones(fields, values) : []), [active, fields, values]);
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getPropertyFieldsForObjectTypeAndGroup, getPropertyGroupByName} from 'mattermost-redux/selectors/entities/properties';

import {getSessionAttrs, SESSION_ATTRIBUTES_TARGET_TYPE} from 'components/admin_console/session_attributes/utils';

import type {GlobalState} from 'types/store';

// Stable reference so memoized consumers don't re-run when there's nothing to merge.
const EMPTY_FIELDS: UserPropertyField[] = [];

// Fetches the session-attribute property group once and returns the ENABLED
// session fields. The CEL autocomplete endpoint returns access control group attributes
// and does not return session attributes, so permission-policy pickers fetch them separately through this
// hook and merge them in. Returns [] until enabled and the fetch resolves.
export function useEnabledSessionAttributeFields(enabled: boolean): UserPropertyField[] {
    const dispatch = useDispatch();

    useEffect(() => {
        if (!enabled) {
            return;
        }
        dispatch(fetchPropertyFields(
            SESSION_ATTRIBUTES_GROUP_ID,
            SESSION_ATTRIBUTES_OBJECT_TYPE,
            SESSION_ATTRIBUTES_TARGET_TYPE,
        ));
    }, [dispatch, enabled]);

    const groupId = useSelector((state: GlobalState) =>
        getPropertyGroupByName(state, SESSION_ATTRIBUTES_GROUP_ID)?.id ?? '');

    const fields = useSelector((state: GlobalState) => {
        if (!enabled || !groupId) {
            return EMPTY_FIELDS;
        }
        return getPropertyFieldsForObjectTypeAndGroup(state, SESSION_ATTRIBUTES_OBJECT_TYPE, groupId) as UserPropertyField[];
    });

    return useMemo(() => {
        if (fields.length === 0) {
            return EMPTY_FIELDS;
        }
        const filtered = fields.filter((field) => getSessionAttrs(field).enabled);
        return filtered.length === 0 ? EMPTY_FIELDS : filtered;
    }, [fields]);
}

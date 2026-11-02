// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {
    ACCESS_CONTROL_PROPERTY_GROUP,
    SYSTEM_TARGET_ID,
    SYSTEM_TARGET_TYPE,
    USER_OBJECT_TYPE,
} from 'mattermost-redux/constants/properties';
import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';
import {getPropertyGroupByName, makeGetPropertyFieldsForObjectTypeAndGroup} from 'mattermost-redux/selectors/entities/properties';

/**
 * Whether the classification clearance attribute is enabled: ABAC is on and a
 * live user field is linked to the classification template. Access policies can
 * then compare a user's clearance with a channel's classification, so markings
 * are no longer informational only. Mirrors the System Console's check.
 *
 * Pass no template id to skip the lookup.
 */
export default function useClassificationClearance(templateFieldId?: string): boolean {
    const dispatch = useDispatch();
    const abacEnabled = Boolean(useSelector(getAccessControlSettings)?.EnableAttributeBasedAccessControl);
    const shouldCheck = abacEnabled && Boolean(templateFieldId);

    const getUserFields = useMemo(() => makeGetPropertyFieldsForObjectTypeAndGroup(), []);
    const groupId = useSelector((state: GlobalState) => getPropertyGroupByName(state, ACCESS_CONTROL_PROPERTY_GROUP)?.id);
    const userFields = useSelector((state: GlobalState) => (groupId ? getUserFields(state, USER_OBJECT_TYPE, groupId) : undefined));

    useEffect(() => {
        if (shouldCheck) {
            dispatch(fetchPropertyFields(ACCESS_CONTROL_PROPERTY_GROUP, USER_OBJECT_TYPE, SYSTEM_TARGET_TYPE, SYSTEM_TARGET_ID));
        }
    }, [shouldCheck, dispatch]);

    return shouldCheck && Boolean(userFields?.some((f) => f.linked_field_id === templateFieldId));
}

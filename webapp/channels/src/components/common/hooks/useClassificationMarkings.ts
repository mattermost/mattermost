// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getChannelAttributeFields} from 'mattermost-redux/selectors/entities/properties';

import {
    CLASSIFICATIONS_CHANNEL_FIELD_NAME,
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_FIELD_TARGET_ID,
    CLASSIFICATIONS_FIELD_TARGET_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
    optionsToLevels,
} from 'components/admin_console/classification_markings/utils';
import type {ClassificationLevel} from 'components/admin_console/classification_markings/utils/presets';

import {isEnterpriseLicense} from 'utils/license_utils';

// Scoped to the channel-object fields of this group rather than scanning every
// field in the store. linked_field_id is what distinguishes the channel field
// from the template it inherits its options from.
function selectChannelClassificationField(state: GlobalState): PropertyField | undefined {
    return getChannelAttributeFields(state).find(
        (f) => f.name === CLASSIFICATIONS_CHANNEL_FIELD_NAME && Boolean(f.linked_field_id),
    );
}

export type ClassificationMarkingsState = {
    available: boolean;
    loading: boolean;
    channelField: PropertyField | null;
    levels: ClassificationLevel[];
};

/**
 * Reusable hook that gates classification markings availability.
 * Returns available=true only when all 3 conditions are met:
 * 1. ClassificationMarkings feature flag is enabled
 * 2. Enterprise license is active
 * 3. Template classification field exists with at least one level configured
 *
 * Also fetches the channel-scoped classification linked field for consumers that need it.
 */
export default function useClassificationMarkings(): ClassificationMarkingsState {
    const dispatch = useDispatch();

    const featureEnabled = useSelector(
        (state: GlobalState) => getFeatureFlagValue(state, 'ClassificationMarkings') === 'true',
    );
    const license = useSelector(getLicense);
    const hasEnterpriseLicense = isEnterpriseLicense(license);
    const channelField = useSelector(selectChannelClassificationField) ?? null;

    useEffect(() => {
        if (!featureEnabled || !hasEnterpriseLicense) {
            return;
        }
        if (!channelField) {
            dispatch(fetchPropertyFields(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
                CLASSIFICATIONS_FIELD_TARGET_TYPE,
                CLASSIFICATIONS_FIELD_TARGET_ID,
            ));
        }
    }, [featureEnabled, hasEnterpriseLicense, channelField, dispatch]);

    const levels = useMemo((): ClassificationLevel[] => {
        if (!channelField) {
            return [];
        }
        const options = (channelField.attrs?.options as PropertyFieldOption[]) || [];
        return optionsToLevels(options);
    }, [channelField]);

    const loading = featureEnabled && hasEnterpriseLicense && !channelField;

    const available = featureEnabled && hasEnterpriseLicense && levels.length > 0;

    return {available, loading, channelField, levels};
}

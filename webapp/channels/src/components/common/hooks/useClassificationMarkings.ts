// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';

import {
    CHANNEL_LINKED_FIELD_NAME,
    CHANNEL_LINKED_OBJECT_TYPE,
    FIELD_NAME,
    GROUP_NAME,
    OBJECT_TYPE,
    TARGET_ID,
    TARGET_TYPE,
    optionsToLevels,
} from 'components/admin_console/classification_markings/utils';
import type {ClassificationLevel} from 'components/admin_console/classification_markings/utils/presets';

import {isEnterpriseLicense} from 'utils/license_utils';

function selectClassificationTemplateField(state: GlobalState): PropertyField | undefined {
    const byId = state.entities.properties?.fields?.byId;
    if (!byId) {
        return undefined;
    }
    return Object.values(byId).find(
        (f) => f.object_type === OBJECT_TYPE && f.name === FIELD_NAME && f.delete_at === 0,
    );
}

function selectChannelClassificationField(state: GlobalState): PropertyField | undefined {
    const byId = state.entities.properties?.fields?.byId;
    if (!byId) {
        return undefined;
    }
    return Object.values(byId).find(
        (f) => f.object_type === CHANNEL_LINKED_OBJECT_TYPE && f.name === CHANNEL_LINKED_FIELD_NAME && f.linked_field_id && f.delete_at === 0,
    );
}

export type ClassificationMarkingsState = {
    available: boolean;
    loading: boolean;
    templateField: PropertyField | null;
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
 * Also fetches the channel_classification linked field for consumers that need it.
 */
export default function useClassificationMarkings(): ClassificationMarkingsState {
    const dispatch = useDispatch();

    const featureEnabled = useSelector(
        (state: GlobalState) => getFeatureFlagValue(state, 'ClassificationMarkings') === 'true',
    );
    const license = useSelector(getLicense);
    const hasEnterpriseLicense = isEnterpriseLicense(license);
    const templateField = useSelector(selectClassificationTemplateField) ?? null;
    const channelField = useSelector(selectChannelClassificationField) ?? null;

    useEffect(() => {
        if (!featureEnabled || !hasEnterpriseLicense) {
            return;
        }
        if (!templateField) {
            dispatch(fetchPropertyFields(GROUP_NAME, OBJECT_TYPE, TARGET_TYPE, TARGET_ID));
        }
        if (!channelField) {
            dispatch(fetchPropertyFields(GROUP_NAME, CHANNEL_LINKED_OBJECT_TYPE, TARGET_TYPE, ''));
        }
    }, [featureEnabled, hasEnterpriseLicense, templateField, channelField, dispatch]);

    const levels = useMemo((): ClassificationLevel[] => {
        if (!templateField) {
            return [];
        }
        const options = (templateField.attrs?.options as PropertyFieldOption[]) || [];
        return optionsToLevels(options);
    }, [templateField]);

    const loading = featureEnabled && hasEnterpriseLicense && !templateField;

    const available = featureEnabled && hasEnterpriseLicense && levels.length > 0;

    return {available, loading, templateField, channelField, levels};
}

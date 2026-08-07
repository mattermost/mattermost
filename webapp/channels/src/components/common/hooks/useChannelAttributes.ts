// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {
    ACCESS_CONTROL_PROPERTY_GROUP,
    CHANNEL_OBJECT_TYPE,
    SYSTEM_TARGET_ID,
    SYSTEM_TARGET_TYPE,
} from 'mattermost-redux/constants/properties';
import {getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getChannelAttributeFields} from 'mattermost-redux/selectors/entities/properties';

import {isEnterpriseLicense} from 'utils/license_utils';

export type ChannelAttributesState = {
    enabled: boolean;
    loading: boolean;
    failed: boolean;
    fields: PropertyField[];
};

/**
 * Loads the channel attribute definitions and reports whether the feature is
 * usable at all. Gated on the ChannelAttributes flag and an Enterprise licence,
 * matching the server, which rejects access_control writes without one.
 *
 * Fetching is unconditional on mount rather than skipped when fields are already
 * cached: fetchPropertyFields does an authoritative scoped replace, so this is
 * also how a field deleted server-side stops appearing without a reload.
 *
 * This fetch is also the only thing that supplies the group name -> UUID mapping
 * the field selectors resolve through; a websocket field event populates the
 * fields alone. So when it fails the store can hold fields that nothing can read,
 * which is why the outcome is tracked here rather than inferred from the store:
 * an empty result and a failed load are not the same thing, and only one of them
 * is worth telling the user about.
 */
export default function useChannelAttributes(): ChannelAttributesState {
    const dispatch = useDispatch();

    const enabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'ChannelAttributes') === 'true');
    const hasEnterpriseLicense = isEnterpriseLicense(useSelector(getLicense));
    const available = enabled && hasEnterpriseLicense;

    const fields = useSelector(getChannelAttributeFields);

    const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');

    useEffect(() => {
        if (!available) {
            setStatus('idle');
            return undefined;
        }

        // Guards against settling the state of a fetch whose consumer is gone, or
        // that a newer fetch has already superseded.
        let current = true;
        setStatus('loading');

        dispatch(fetchPropertyFields(
            ACCESS_CONTROL_PROPERTY_GROUP,
            CHANNEL_OBJECT_TYPE,
            SYSTEM_TARGET_TYPE,
            SYSTEM_TARGET_ID,
        )).then((result) => {
            if (current) {
                setStatus(result?.error ? 'failed' : 'loaded');
            }
        }).catch(() => {
            if (current) {
                setStatus('failed');
            }
        });

        return () => {
            current = false;
        };
    }, [available, dispatch]);

    return {
        enabled: available,
        loading: available && (status === 'idle' || status === 'loading'),
        failed: available && status === 'failed',
        fields: available ? fields : [],
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState} from 'react';
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

import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';

export type ChannelAttributesOptions = {

    /**
     * Skip the fetch when the store already holds the channel attribute fields. For
     * indicators mounted several at a time on every channel view, which only need
     * the definitions to exist, not an authoritative refresh each time.
     */
    reuseLoadedFields?: boolean;

    /**
     * Report nothing and send no request, for an indicator that has already
     * ruled the channel (or the whole feature) out.
     */
    skip?: boolean;
};

export type ChannelAttributesState = {
    enabled: boolean;
    loading: boolean;
    failed: boolean;
    fields: PropertyField[];
};

// Mounts that start together share one request instead of each sending their own.
type FieldsResult = Awaited<ReturnType<ReturnType<typeof fetchPropertyFields>>>;
const fieldFetchesInFlight = new WeakMap<object, Promise<FieldsResult>>();

// The websocket connect time current at the last fields fetch, shared across mounts.
// Reusing cached fields is only valid until a reconnect, since field events
// may have been missed while the socket was down.
const fieldsFetchedAtConnect = new WeakMap<object, number>();

/**
 * Loads the channel attribute definitions and reports whether the feature is
 * usable at all. Gated on the ChannelAttributes flag and Enterprise Advanced,
 * matching the server, which refuses channel-scoped access_control objects
 * below that tier.
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
export default function useChannelAttributes({reuseLoadedFields = false, skip = false}: ChannelAttributesOptions = {}): ChannelAttributesState {
    const dispatch = useDispatch();

    const enabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'ChannelAttributes') === 'true');
    const hasAdvancedLicense = isMinimumEnterpriseAdvancedLicense(useSelector(getLicense));
    const available = enabled && hasAdvancedLicense && !skip;
    const lastConnectAt = useSelector((state: GlobalState) => state.websocket?.lastConnectAt ?? 0);

    const fields = useSelector(getChannelAttributeFields);

    const hasFieldsRef = useRef(false);
    hasFieldsRef.current = fields.length > 0;
    const reusingFields = reuseLoadedFields && fields.length > 0;

    const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');

    useEffect(() => {
        if (!available) {
            setStatus('idle');
            return undefined;
        }

        // A non-empty field list is only readable once the group mapping has landed,
        // so it is as good as the fetch's own result.
        const fetchedAt = fieldsFetchedAtConnect.get(dispatch);
        const reconnectedSinceFetch = fetchedAt !== undefined && fetchedAt !== lastConnectAt;
        if (reuseLoadedFields && hasFieldsRef.current && !reconnectedSinceFetch) {
            setStatus('loaded');
            return undefined;
        }

        // Guards against settling the state of a fetch whose consumer is gone, or
        // that a newer fetch has already superseded.
        let current = true;
        setStatus('loading');

        let request = fieldFetchesInFlight.get(dispatch);
        if (!request) {
            fieldsFetchedAtConnect.set(dispatch, lastConnectAt);
            const started: Promise<FieldsResult> = Promise.resolve(dispatch(fetchPropertyFields(
                ACCESS_CONTROL_PROPERTY_GROUP,
                CHANNEL_OBJECT_TYPE,
                {targetType: SYSTEM_TARGET_TYPE, targetId: SYSTEM_TARGET_ID},
            ))).finally(() => {
                if (fieldFetchesInFlight.get(dispatch) === started) {
                    fieldFetchesInFlight.delete(dispatch);
                }
            });
            fieldFetchesInFlight.set(dispatch, started);
            request = started;
        }

        request.then((result) => {
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
    }, [available, dispatch, reuseLoadedFields, lastConnectAt]);

    return {
        enabled: available,
        loading: available && !reusingFields && (status === 'idle' || status === 'loading'),
        failed: available && status === 'failed',
        fields: available ? fields : [],
    };
}

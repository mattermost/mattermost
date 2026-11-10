// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import type {Dispatch} from 'redux';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {fetchPropertyValues} from 'mattermost-redux/actions/properties';
import {ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE} from 'mattermost-redux/constants/properties';
import {isChannelAttributesRequiredEnabled} from 'mattermost-redux/selectors/entities/general';
import {arePropertyValuesLoadedForTarget, makeGetPropertyValuesForTarget} from 'mattermost-redux/selectors/entities/properties';
import {isPropertyFieldRequired, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import type {GlobalState} from 'types/store';

import useChannelAttributes from './useChannelAttributes';

export type MissingRequiredChannelAttributesState = {
    loading: boolean;
    missing: PropertyField[];
};

type RequestState = {
    channelId: string;
    status: 'loading' | 'loaded' | 'failed';
    missing: PropertyField[];
};

const EMPTY_MISSING: PropertyField[] = [];

const IDLE: RequestState = {channelId: '', status: 'loaded', missing: []};

// RECEIVED_PROPERTY_VALUES only merges, so a cached value for a field the
// server now omits must be dropped explicitly.
function dropOmittedValues(
    dispatch: Dispatch,
    channelId: string,
    requiredFields: PropertyField[],
    values: Array<PropertyValue<unknown>> | undefined,
) {
    const returnedFieldIds = new Set((values ?? []).map((v) => v.field_id));
    for (const field of requiredFields) {
        if (!returnedFieldIds.has(field.id)) {
            dispatch({
                type: PropertyTypes.PROPERTY_VALUE_DELETED,
                data: {targetId: channelId, fieldId: field.id},
            });
        }
    }
}

export type MissingRequiredChannelAttributesOptions = {

    /**
     * Read the channel's values from the store when they have already been
     * loaded, and fetch them once otherwise. The default is a fresh fetch on
     * every channel change, which the unarchive dialog wants.
     */
    preferStore?: boolean;

    /**
     * Report nothing and make no request, for a caller that has already ruled
     * the channel out (a DM, an archived channel).
     */
    skip?: boolean;
};

export function missingRequiredFields(
    fields: PropertyField[],
    values: Array<PropertyValue<unknown>> | undefined,
): PropertyField[] {
    return fields.filter((field) => {
        if (!isPropertyFieldRequired(field)) {
            return false;
        }
        const value = values?.find((v) => v.field_id === field.id);
        return !isPropertyValueSet(value?.value);
    });
}

/**
 * Reports which required channel attributes lack a value on this channel --
 * the advisory check behind the unarchive warning (MM-70717; unarchive itself
 * is warn-only and never blocked on this).
 *
 * Fails open: while the value fetch is in flight, and if it errors, `missing`
 * is `[]` rather than every required field. `missing` is derived from the
 * fetch response directly, not from a Redux selector -- Redux may not have
 * this channel's values cached yet (or ever, if this channel was never
 * mounted elsewhere), and reading it as authoritative would read "no cached
 * value" as "unset" on every cold load, well before the fetch below settles.
 *
 * Reports nothing while ChannelAttributesRequired is off: the server enforces
 * Required on no channel attribute then, so there is nothing to warn about.
 */
export default function useMissingRequiredChannelAttributes(
    channelId: string,
    {preferStore = false, skip = false}: MissingRequiredChannelAttributesOptions = {},
): MissingRequiredChannelAttributesState {
    const dispatch = useDispatch();

    const {enabled: attributesEnabled, loading: fieldsLoading, fields} = useChannelAttributes();
    const requiredEnforced = useSelector(isChannelAttributesRequiredEnabled);
    const enabled = !skip && attributesEnabled && requiredEnforced;
    const requiredFields = useMemo(() => fields.filter(isPropertyFieldRequired), [fields]);

    const [request, setRequest] = useState<RequestState>(IDLE);

    const getValuesForTarget = useMemo(() => makeGetPropertyValuesForTarget(), []);
    const loadedInStore = useSelector((state: GlobalState) => arePropertyValuesLoadedForTarget(state, channelId));
    const storeValues = useSelector((state: GlobalState) => getValuesForTarget(state, channelId));

    const inFlightChannelId = useRef<string | null>(null);
    const active = enabled && requiredFields.length > 0;

    // Store-first mode: fetch whenever this channel's values aren't marked
    // loaded -- on first sight, and again when a reconnect clears the marker
    // while the hook stays mounted. The ref keeps one request per channel in
    // flight, and the marker flipping when the fetch lands doesn't cancel it,
    // so the stale-value cleanup below always runs.
    useEffect(() => {
        if (!preferStore || !active || loadedInStore || inFlightChannelId.current === channelId) {
            return;
        }
        inFlightChannelId.current = channelId;
        setRequest({channelId, status: 'loading', missing: []});

        dispatch(fetchPropertyValues(ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, channelId)).then((result) => {
            dropOmittedValues(dispatch, channelId, requiredFields, result.data);
            setRequest({channelId, status: 'loaded', missing: []});
        }).catch(() => {
            // Fail open -- see doc comment above.
            setRequest({channelId, status: 'failed', missing: []});
        }).finally(() => {
            if (inFlightChannelId.current === channelId) {
                inFlightChannelId.current = null;
            }
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferStore, active, loadedInStore, channelId]);

    useEffect(() => {
        if (preferStore) {
            return undefined;
        }
        if (!enabled || requiredFields.length === 0) {
            setRequest({channelId, status: 'loaded', missing: []});
            return undefined;
        }

        // Guards against a slower request for a previous channelId settling
        // after a newer one has already started -- without this, switching
        // channels quickly could let a stale response overwrite the current
        // channel's result.
        let current = true;
        setRequest({channelId, status: 'loading', missing: []});

        dispatch(fetchPropertyValues(ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, channelId)).then((result) => {
            if (!current) {
                return;
            }
            const values = result.data;

            dropOmittedValues(dispatch, channelId, requiredFields, values);
            setRequest({channelId, status: 'loaded', missing: missingRequiredFields(requiredFields, values)});
        }).catch(() => {
            if (!current) {
                return;
            }

            // Fail open -- see doc comment above.
            setRequest({channelId, status: 'failed', missing: []});
        });

        return () => {
            current = false;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, channelId, requiredFields.length, preferStore]);

    const storeMissing = useMemo(() => (
        preferStore && active && loadedInStore ? missingRequiredFields(requiredFields, storeValues) : EMPTY_MISSING
    ), [preferStore, active, loadedInStore, requiredFields, storeValues]);

    if (preferStore) {
        const failed = request.channelId === channelId && request.status === 'failed';
        return {
            loading: fieldsLoading || (active && !loadedInStore && !failed),
            missing: storeMissing,
        };
    }

    // A request still in flight for this channelId (or one that hasn't
    // started yet after channelId just changed) reports loading with an
    // empty `missing`, not the previous channel's result.
    const forThisChannel = request.channelId === channelId;
    const valuesLoading = !forThisChannel || request.status === 'loading';

    return {
        loading: fieldsLoading || (enabled && requiredFields.length > 0 && valuesLoading),
        missing: forThisChannel ? request.missing : [],
    };
}

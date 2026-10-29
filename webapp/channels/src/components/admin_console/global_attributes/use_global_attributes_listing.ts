// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';

import type {GlobalAttributeListingRow, GlobalAttributeListingSearch, GlobalAttributeSource} from '@mattermost/types/global_attributes';

import PropertyTypes from 'mattermost-redux/action_types/properties';
import {Client4} from 'mattermost-redux/client';

import {useDebounce} from 'hooks/useDebounce';
import {useLatest} from 'hooks/useLatest';

import {subscribeToAttributeFieldChanges} from './listing_events';

export const LISTING_DEBOUNCE_MS = 300;

export type GlobalAttributesListingOptions = {
    term?: string;
    source?: GlobalAttributeSource;
};

export type GlobalAttributesListingResult = {
    rows: GlobalAttributeListingRow[];

    // Whether a response has arrived yet. The rows stay as the last response left
    // them while a newer request is in flight.
    loaded: boolean;
    loading: boolean;
    error: boolean;
    refetch: () => Promise<void>;
};

function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        if (value === debounced) {
            return undefined;
        }
        const timeout = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timeout);
    }, [value, debounced, delay]);

    return debounced;
}

// Owns the listing request: the search term (debounced) and source filter, one
// in-flight request at a time that matters, and the refetch triggers.
export default function useGlobalAttributesListing({
    term = '',
    source,
}: GlobalAttributesListingOptions = {}): GlobalAttributesListingResult {
    const dispatch = useDispatch();

    const debouncedTerm = useDebouncedValue(term.trim(), LISTING_DEBOUNCE_MS);

    const [rows, setRows] = useState<GlobalAttributeListingRow[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const latestRequestId = useRef(0);

    const fetchListing = useCallback(async () => {
        const search: GlobalAttributeListingSearch = {
            term: debouncedTerm || undefined,
            source,
        };
        const requestId = ++latestRequestId.current;
        setLoading(true);

        try {
            const response = await Client4.searchGlobalAttributes(search);
            if (requestId !== latestRequestId.current) {
                return;
            }

            // Row fields land in Redux so the delete reducer and the other
            // consumers of cached property fields see them.
            dispatch({type: PropertyTypes.RECEIVED_PROPERTY_FIELDS, data: {fields: response.rows.map((row) => row.field)}});
            setRows(response.rows);
            setError(false);
            setLoading(false);
        } catch (err) {
            if (requestId !== latestRequestId.current) {
                return;
            }
            console.error('useGlobalAttributesListing: ', err); // eslint-disable-line no-console
            setError(true);
            setLoading(false);
        }
    }, [debouncedTerm, source, dispatch]);

    useEffect(() => {
        fetchListing();

        // Any response still in flight is stale once the request changes, and
        // after unmount.
        return () => {
            // The counter is meant to be read as it is when cleanup runs.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            latestRequestId.current++;
        };
    }, [fetchListing]);

    const scheduleRefetch = useDebounce(fetchListing, LISTING_DEBOUNCE_MS);
    const knownGroupId = useLatest(rows?.[0]?.field.group_id);
    useEffect(() => subscribeToAttributeFieldChanges((groupId) => {
        // Rows only ever belong to one group, so another group's change is not ours.
        if (groupId && knownGroupId.current && groupId !== knownGroupId.current) {
            return;
        }
        scheduleRefetch();
    }), [knownGroupId, scheduleRefetch]);

    return {
        rows: rows ?? [],
        loaded: rows !== null,
        loading,
        error,
        refetch: fetchListing,
    };
}

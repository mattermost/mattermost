// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';

import type {
    GlobalAttributeListingRow,
    GlobalAttributeListingSearch,
    GlobalAttributeResourceType,
    GlobalAttributeSource,
} from '@mattermost/types/global_attributes';

import PropertyTypes from 'mattermost-redux/action_types/properties';
import {Client4} from 'mattermost-redux/client';

import {useDebounce} from 'hooks/useDebounce';
import {useLatest} from 'hooks/useLatest';

import {subscribeToAttributeFieldChanges} from './listing_events';

export const LISTING_DEBOUNCE_MS = 300;
export const LISTING_DEFAULT_PER_PAGE = 50;

export type GlobalAttributesListingOptions = {
    term?: string;
    source?: GlobalAttributeSource;
    resourceType?: GlobalAttributeResourceType;
    perPage?: number;
};

export type GlobalAttributesListingResult = {
    rows: GlobalAttributeListingRow[];

    // Matches across every page, not just the rows returned.
    totalCount: number;

    // Zero-based.
    page: number;
    perPage: number;
    setPage: (page: number) => void;

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

type Listing = {rows: GlobalAttributeListingRow[]; totalCount: number};

// Owns the listing request: the search term (debounced), the filters and the
// page, one in-flight request at a time that matters, and the refetch triggers.
//
// A change to the term or to a filter returns to the first page; only the term is
// debounced, since a filter is picked rather than typed.
export default function useGlobalAttributesListing({
    term = '',
    source,
    resourceType,
    perPage = LISTING_DEFAULT_PER_PAGE,
}: GlobalAttributesListingOptions = {}): GlobalAttributesListingResult {
    const dispatch = useDispatch();

    const debouncedTerm = useDebouncedValue(term.trim(), LISTING_DEBOUNCE_MS);

    // The page is stored with the filters it was chosen under, so a filter change
    // reads as page 0 in the same render instead of fetching a stale page first.
    const filterKey = JSON.stringify([debouncedTerm, source, resourceType]);
    const [pageState, setPageState] = useState({filterKey, page: 0});
    const page = pageState.filterKey === filterKey ? pageState.page : 0;
    const setPage = useCallback((next: number) => setPageState({filterKey, page: next}), [filterKey]);

    const [listing, setListing] = useState<Listing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const latestRequestId = useRef(0);

    const fetchListing = useCallback(async () => {
        const search: GlobalAttributeListingSearch = {
            term: debouncedTerm || undefined,
            source,
            resource_type: resourceType,
            page,
            per_page: perPage,
        };
        const requestId = ++latestRequestId.current;
        setLoading(true);

        try {
            const response = await Client4.searchGlobalAttributes(search);
            if (requestId !== latestRequestId.current) {
                return;
            }

            // The page emptied underneath us, e.g. its last row was deleted. Step
            // back to the last page that still has rows; the new page refetches.
            if (response.rows.length === 0 && page > 0) {
                setPage(Math.max(0, Math.ceil(response.total_count / perPage) - 1));
                return;
            }

            // Row fields land in Redux so the delete reducer and the other
            // consumers of cached property fields see them.
            dispatch({type: PropertyTypes.RECEIVED_PROPERTY_FIELDS, data: {fields: response.rows.map((row) => row.field)}});
            setListing({rows: response.rows, totalCount: response.total_count});
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
    }, [debouncedTerm, source, resourceType, page, perPage, dispatch, setPage]);

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
    const knownGroupId = useLatest(listing?.rows[0]?.field.group_id);
    useEffect(() => subscribeToAttributeFieldChanges((groupId) => {
        // Rows only ever belong to one group, so another group's change is not ours.
        if (groupId && knownGroupId.current && groupId !== knownGroupId.current) {
            return;
        }
        scheduleRefetch();
    }), [knownGroupId, scheduleRefetch]);

    return {
        rows: listing?.rows ?? [],
        totalCount: listing?.totalCount ?? 0,
        page,
        perPage,
        setPage,
        loaded: listing !== null,
        loading,
        error,
        refetch: fetchListing,
    };
}

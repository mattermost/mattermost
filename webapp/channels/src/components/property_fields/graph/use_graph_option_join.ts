// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {joinGraphOptions} from '.';
import type {GraphOptionJoin} from '.';
import {pageAllAccessControlFieldOptions} from './page_all_access_control_field_options';
import type {GraphFieldRef} from './page_all_access_control_field_options';

export type GraphJoinStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type UseGraphOptionJoinOpts = {
    prefetch?: boolean;
    open?: boolean;
    onOptionsLoaded?: (join: GraphOptionJoin) => void;
};

export type UseGraphOptionJoinResult = {
    options: PropertyFieldOption[] | null;
    join: GraphOptionJoin;
    status: GraphJoinStatus;
    refetch: () => void;
};

export function useGraphOptionJoin(
    field: GraphFieldRef,
    opts?: UseGraphOptionJoinOpts,
): UseGraphOptionJoinResult {
    const prefetch = opts?.prefetch ?? false;
    const open = opts?.open ?? false;
    const {onOptionsLoaded} = opts ?? {};

    const [loaded, setLoaded] = useState<{options: PropertyFieldOption[]; join: GraphOptionJoin} | null>(null);
    const [status, setStatus] = useState<GraphJoinStatus>('idle');

    const abortRef = useRef<AbortController | null>(null);

    // Shared walks keep running after abort; ignore late results from a stale request.
    const seqRef = useRef(0);

    // Menu.Container reports onToggle(false) on mount; only a real close aborts.
    const wasOpenRef = useRef(false);
    const prefetchedRef = useRef(false);

    const emptyJoin = useMemo(() => joinGraphOptions([]), []);

    const refetch = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;

        const seq = seqRef.current + 1;
        seqRef.current = seq;

        const controller = new AbortController();
        abortRef.current = controller;

        setStatus('loading');

        pageAllAccessControlFieldOptions(
            {id: field.id, object_type: field.object_type},
            {signal: controller.signal},
        ).then(
            (fetched) => {
                if (seqRef.current !== seq) {
                    return;
                }
                const fetchedJoin = joinGraphOptions(fetched);
                setLoaded({options: fetched, join: fetchedJoin});

                // Same commit as the status flip so expand-to-selected seeds from the hydrated ids.
                onOptionsLoaded?.(fetchedJoin);
                setStatus('loaded');
            },
            (error: unknown) => {
                if (seqRef.current !== seq) {
                    return;
                }

                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }

                setStatus('error');
            },
        );
    }, [field.id, field.object_type, onOptionsLoaded]);

    useEffect(() => {
        if (open) {
            wasOpenRef.current = true;
            refetch();
            return;
        }

        if (!wasOpenRef.current) {
            return;
        }
        wasOpenRef.current = false;
        abortRef.current?.abort();
        abortRef.current = null;
    }, [open, refetch]);

    useEffect(() => {
        if (!prefetch || prefetchedRef.current) {
            return;
        }
        prefetchedRef.current = true;
        refetch();
    }, [prefetch, refetch]);

    useEffect(() => () => {
        abortRef.current?.abort();
        abortRef.current = null;
    }, []);

    return {
        options: loaded?.options ?? null,
        join: loaded?.join ?? emptyJoin,
        status,
        refetch,
    };
}

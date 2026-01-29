// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';
import {useDispatch} from 'react-redux';

import {cleanupPublishedDraftTimestamps} from 'actions/pages';

const CLEANUP_INTERVAL_MS = 60000;

export function usePublishedDraftCleanup() {
    const dispatch = useDispatch();
    const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        cleanupIntervalRef.current = setInterval(() => {
            dispatch(cleanupPublishedDraftTimestamps());
        }, CLEANUP_INTERVAL_MS);

        return () => {
            if (cleanupIntervalRef.current) {
                clearInterval(cleanupIntervalRef.current);
            }
        };
    }, [dispatch]);
}

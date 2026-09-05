// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

type Options = {
    preserveGlobalViews?: boolean;
};

// Suppress channel-scoped RHS on static pages (Threads, Drafts, Recaps).
// preserveGlobalViews keeps mentions, search, and saved posts open on mount.
// Plugin RHS (e.g. leftover Playbooks) is always suppressed on mount.
// Mount-only: later App Bar / mentions opens must not re-suppress.
export default function useSuppressRHS({
    preserveGlobalViews = false,
}: Options = {}) {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);

    useEffect(() => {
        const preserve =
            preserveGlobalViews &&
            (rhsState === RHSStates.MENTION ||
                rhsState === RHSStates.SEARCH ||
                rhsState === RHSStates.FLAG);

        if (!preserve) {
            dispatch(suppressRHS);
        }

        return () => {
            dispatch(unsuppressRHS);
        };

        // rhsState is read only on mount so later App Bar / mentions opens are not re-suppressed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, preserveGlobalViews]);
}

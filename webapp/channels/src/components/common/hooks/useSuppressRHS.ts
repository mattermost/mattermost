// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

type Options = {
    preserveGlobalViews?: boolean;
    preservePluginViews?: boolean;
};

// Suppress channel-scoped RHS on static pages (Threads, Drafts, Recaps).
// preserveGlobalViews keeps mentions, search, and saved posts open.
// preservePluginViews keeps plugin RHS open (Threads; Recaps still hides Playbooks).
export default function useSuppressRHS({
    preserveGlobalViews = false,
    preservePluginViews = false,
}: Options = {}) {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);

    useEffect(() => {
        const preserve =
            (preserveGlobalViews &&
                (rhsState === RHSStates.MENTION ||
                    rhsState === RHSStates.SEARCH ||
                    rhsState === RHSStates.FLAG)) ||
            (preservePluginViews && rhsState === RHSStates.PLUGIN);

        if (!preserve) {
            dispatch(suppressRHS);
        }

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch, preserveGlobalViews, preservePluginViews, rhsState]);
}

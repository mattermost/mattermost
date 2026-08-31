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
let suppressEffectRunId = 0;

export default function useSuppressRHS({
    preserveGlobalViews = false,
    preservePluginViews = false,
}: Options = {}) {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);

    useEffect(() => {
        const runId = ++suppressEffectRunId;
        const preserveGlobal =
            preserveGlobalViews &&
            (rhsState === RHSStates.MENTION ||
                rhsState === RHSStates.SEARCH ||
                rhsState === RHSStates.FLAG);
        const preservePlugin = preservePluginViews && rhsState === RHSStates.PLUGIN;
        const preserve = preserveGlobal || preservePlugin;

        // #region agent log
        try {
            require('fs').appendFileSync('/opt/cursor/logs/debug.log', JSON.stringify({hypothesisId: preservePlugin ? 'A' : 'B', location: 'useSuppressRHS.ts:effect', message: 'useSuppressRHS effect run', data: {runId, preserveGlobalViews, preservePluginViews, rhsState, preserveGlobal, preservePlugin, preserve, willSuppress: !preserve}, timestamp: Date.now()}) + '\n');
        } catch { /* debug log */ }
        // #endregion

        if (!preserve) {
            dispatch(suppressRHS);
        }

        return () => {
            // #region agent log
            try {
                require('fs').appendFileSync('/opt/cursor/logs/debug.log', JSON.stringify({hypothesisId: 'B', location: 'useSuppressRHS.ts:cleanup', message: 'useSuppressRHS cleanup always unsuppressRHS', data: {runId, preserveGlobalViews, preservePluginViews, rhsState, preserve}, timestamp: Date.now()}) + '\n');
            } catch { /* debug log */ }
            // #endregion
            dispatch(unsuppressRHS);
        };
    }, [dispatch, preserveGlobalViews, preservePluginViews, rhsState]);
}

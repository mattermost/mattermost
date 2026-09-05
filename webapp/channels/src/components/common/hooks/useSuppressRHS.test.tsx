// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, runPostRenderAct} from 'tests/react_testing_utils';
import {ActionTypes, RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

import useSuppressRHS from './useSuppressRHS';

function Harness({
    preserveGlobalViews,
}: {
    preserveGlobalViews?: boolean;
}) {
    useSuppressRHS({preserveGlobalViews});
    return null;
}

function renderHarness(
    preserveGlobalViews = false,
    rhsState: RhsState = null,
) {
    return renderWithContext(
        <Harness
            preserveGlobalViews={preserveGlobalViews}
        />,
        {
            views: {
                rhs: {rhsState},
                rhsSuppressed: false,
            },
        },
    );
}

describe('useSuppressRHS', () => {
    test('suppresses the RHS on mount and restores it on unmount', () => {
        const {store, unmount} = renderHarness();

        expect(store.getState().views.rhsSuppressed).toBe(true);

        unmount();

        expect(store.getState().views.rhsSuppressed).toBe(false);
    });

    test.each([
        ['mentions', RHSStates.MENTION],
        ['search', RHSStates.SEARCH],
        ['saved posts', RHSStates.FLAG],
    ])('does not suppress the RHS when %s is open and preserveGlobalViews is set', (_label, rhsState) => {
        const {store, unmount} = renderHarness(true, rhsState);

        expect(store.getState().views.rhsSuppressed).toBe(false);

        unmount();

        expect(store.getState().views.rhsSuppressed).toBe(false);
    });

    test('still suppresses plugin RHS when preserveGlobalViews is set', () => {
        const {store} = renderHarness(true, RHSStates.PLUGIN);

        expect(store.getState().views.rhsSuppressed).toBe(true);
    });

    test('does not re-suppress after mount when a plugin RHS is opened', async () => {
        const {store} = renderHarness(true, RHSStates.PIN);

        expect(store.getState().views.rhsSuppressed).toBe(true);

        store.dispatch({
            type: ActionTypes.UPDATE_RHS_STATE,
            state: RHSStates.PLUGIN,
            pluggableId: 'plugin',
        });
        await runPostRenderAct();

        expect(store.getState().views.rhsSuppressed).toBe(false);
    });
});

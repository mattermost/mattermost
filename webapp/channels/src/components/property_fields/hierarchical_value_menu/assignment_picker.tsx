// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef} from 'react';
import type {ReactNode} from 'react';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';

import {assignmentFallbackLabels, computeAssignmentPrefetch} from './assignment_adapter';
import HierarchicalValueMenu from './hierarchical_value_menu';
import type {HierarchicalValueMenuField, HierarchicalValueMenuProps} from './hierarchical_value_menu';

import type {GraphOptionJoin} from '../graph_option_tree';

export type AssignmentGraphPickerProps = {

    // The resolved CPA field. Ids in, ids out: assignment does no name translation.
    field: HierarchicalValueMenuField;
    ids: string[];
    onIdsChange: (ids: string[]) => void;
    disabled?: boolean;

    // Today's control, built only when the flag is off. A thunk rather than an
    // element so a class parent does not construct the control it is not going
    // to render on every flag-on pass.
    fallback: () => ReactNode;

    // id -> name for the ids in `ids` a fetch resolved, so a class parent can
    // print names where no picker is mounted: a collapsed row, a change
    // summary. Never fires on abort or error, and carries only ids the fetch
    // actually returned -- a stale id is simply absent, and the caller must not
    // invent a label for it.
    //
    // A successful fetch always reports, even when it names none of the held
    // ids, and the empty map is load-bearing: having been called at all is how
    // a caller tells "the read failed, nothing is known about this id" from
    // "the read succeeded and this id was not in it", which are the same
    // absence in the map but different things on screen. Selection changes
    // still skip an empty report, since a read has already been signalled by
    // then and the only cost would be a wasted render per checkbox click.
    onNamesResolved?: (names: Record<string, string>) => void;
} & Pick<
    HierarchicalValueMenuProps,
'menuId' | 'buttonId' | 'buttonDataTestId' | 'placeholder' | 'ariaLabel' |
'className' | 'buttonClassName'
>;

/**
 * The seam between the two class-component assignment hosts and the tree.
 *
 * It exists for one reason: `useGetFeatureFlagValue` is a hook and both hosts
 * are class components. The flag decision, the prefetch decision and the
 * name-reporting plumbing all live here so neither class file grows a second
 * Client4 walk or a second copy of the prefetch predicate.
 */
export default function AssignmentGraphPicker({
    field,
    ids,
    onIdsChange,
    disabled,
    fallback,
    onNamesResolved,
    ...chrome
}: AssignmentGraphPickerProps) {
    const isGraphEnabled = useGetFeatureFlagValue('PropertyFieldGraph') === 'true';

    const fallbackLabels = useMemo(() => assignmentFallbackLabels(field), [field]);

    // The single assignment fetch trigger. The widget latches it in a ref on
    // mount, so recomputing it on a later `ids` change is inert.
    const prefetchOnMount = useMemo(() => computeAssignmentPrefetch(field, ids), [field, ids]);

    // Read through refs, not closed over: `onOptionsLoaded`'s identity is a
    // dependency of the widget's runFetch, which is in turn a dependency of its
    // open-fetch effect. A handler that changed with `ids` would refetch the
    // open menu on every checkbox click.
    const idsRef = useRef(ids);
    idsRef.current = ids;
    const onNamesResolvedRef = useRef(onNamesResolved);
    onNamesResolvedRef.current = onNamesResolved;

    // The last successful fetch, kept so a value selected after it can still be
    // named. Only a reference to the tree the widget already built.
    const joinRef = useRef<GraphOptionJoin | null>(null);

    // Reports names for the given ids only. Never the whole table: a
    // 1010-option field must not push its full name map into a class
    // component's state.
    const reportNames = useCallback((reportFor: string[], evenIfEmpty = false) => {
        const report = onNamesResolvedRef.current;
        const join = joinRef.current;
        if (!report || !join) {
            return;
        }

        const names: Record<string, string> = {};
        for (const id of reportFor) {
            const name = join.byId.get(id)?.name;
            if (name) {
                names[id] = name;
            }
        }

        if (evenIfEmpty || Object.keys(names).length > 0) {
            report(names);
        }
    }, []);

    const handleOptionsLoaded = useCallback((join: GraphOptionJoin) => {
        joinRef.current = join;

        // Reports even when nothing resolved: this call is the only signal a
        // host gets that a read succeeded at all.
        reportNames(idsRef.current, true);
    }, [reportNames]);

    // A value checked after the fetch is not in `ids` yet when the fetch lands,
    // so its name has to be reported here or a host printing names outside the
    // picker -- a change summary, a collapsed row -- falls back to its raw id.
    const handleIdsChange = useCallback((next: string[]) => {
        reportNames(next);
        onIdsChange(next);
    }, [reportNames, onIdsChange]);

    if (!isGraphEnabled) {
        return <>{fallback()}</>;
    }

    return (
        <HierarchicalValueMenu
            {...chrome}
            field={field}
            selectedIds={ids}
            onSelectedIdsChange={handleIdsChange}
            disabled={disabled}
            fallbackLabels={fallbackLabels}
            prefetchOnMount={prefetchOnMount}
            onOptionsLoaded={handleOptionsLoaded}
        />
    );
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef} from 'react';
import type {ReactNode} from 'react';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';

import {assignmentFallbackLabels, computeAssignmentPrefetch} from './assignment_adapter';
import HierarchicalValueMenu from './hierarchical_value_menu';
import type {GraphFieldRef, HierarchicalValueMenuProps} from './hierarchical_value_menu';

import type {GraphOptionJoin} from '../graph_option_tree';

export type AssignmentGraphPickerProps = {
    field: GraphFieldRef;
    ids: string[];
    onIdsChange: (ids: string[]) => void;
    disabled?: boolean;

    // Flag-off control. Thunk so a class parent does not build it on flag-on renders.
    fallback: () => ReactNode;

    // Names the last successful fetch resolved. Always called on success, including
    // with {}: that is how a host tells a failed read from a successful miss.
    onNamesResolved?: (names: Record<string, string>) => void;
} & Pick<
    HierarchicalValueMenuProps,
'menuId' | 'buttonId' | 'buttonDataTestId' | 'placeholder' | 'ariaLabel' |
'className' | 'buttonClassName'
>;

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

    const prefetchOnMount = useMemo(() => computeAssignmentPrefetch(field, ids), [field, ids]);

    const idsRef = useRef(ids);
    idsRef.current = ids;
    const onNamesResolvedRef = useRef(onNamesResolved);
    onNamesResolvedRef.current = onNamesResolved;

    const joinRef = useRef<GraphOptionJoin | null>(null);

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
        reportNames(idsRef.current, true);
    }, [reportNames]);

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

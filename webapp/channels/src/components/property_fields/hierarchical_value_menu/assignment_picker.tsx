// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef} from 'react';
import type {ReactNode} from 'react';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';

import {assignmentFallbackLabels, computeAssignmentPrefetch} from '../graph/assignment_prefetch';
import type {GraphOptionJoin} from '../graph';
import type {GraphFieldRef} from '../graph/page_all_access_control_field_options';
import {commitGraphOptionNames} from '../graph/use_graph_option_names';

import HierarchicalValueMenu from './hierarchical_value_menu';
import type {HierarchicalValueMenuProps} from './hierarchical_value_menu';

export {computeAssignmentPrefetch, assignmentFallbackLabels};

export type AssignmentGraphPickerProps = {
    field: GraphFieldRef;
    ids: string[];
    onIdsChange: (ids: string[]) => void;
    disabled?: boolean;

    // Flag-off control. Thunk so a class parent does not build it on flag-on renders.
    fallback: () => ReactNode;
} & Pick<
    HierarchicalValueMenuProps,
'menuId' | 'buttonId' | 'buttonDataTestId' | 'placeholder' | 'ariaLabel' |
'className' | 'buttonClassName'
>;

function namesForHeldIds(join: GraphOptionJoin, reportFor: string[]): Record<string, string> {
    const names: Record<string, string> = {};
    for (const id of reportFor) {
        const name = join.byId.get(id)?.name;
        if (name) {
            names[id] = name;
        }
    }
    return names;
}

export default function AssignmentGraphPicker({
    field,
    ids,
    onIdsChange,
    disabled,
    fallback,
    ...chrome
}: AssignmentGraphPickerProps) {
    const isGraphEnabled = useGetFeatureFlagValue('PropertyFieldGraph') === 'true';

    const fallbackLabels = useMemo(() => assignmentFallbackLabels(field), [field]);

    const prefetchOnMount = useMemo(() => computeAssignmentPrefetch(field, ids), [field, ids]);

    const idsRef = useRef(ids);
    idsRef.current = ids;

    const joinRef = useRef<GraphOptionJoin | null>(null);

    const handleOptionsLoaded = useCallback((join: GraphOptionJoin) => {
        joinRef.current = join;
        commitGraphOptionNames(field.id, namesForHeldIds(join, idsRef.current));
    }, [field.id]);

    const handleIdsChange = useCallback((next: string[]) => {
        const join = joinRef.current;
        if (join) {
            const names = namesForHeldIds(join, next);
            if (Object.keys(names).length > 0) {
                commitGraphOptionNames(field.id, names);
            }
        }
        onIdsChange(next);
    }, [field.id, onIdsChange]);

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

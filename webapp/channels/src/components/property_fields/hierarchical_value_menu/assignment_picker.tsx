// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef} from 'react';

import HierarchicalValueMenu from './hierarchical_value_menu';
import type {HierarchicalValueMenuProps} from './hierarchical_value_menu';

import type {GraphOptionJoin} from '../graph';
import {assignmentFallbackLabels, computeAssignmentPrefetch} from '../graph/assignment_prefetch';
import type {GraphFieldRef} from '../graph/page_all_access_control_field_options';
import {commitGraphOptionNames, graphJoinNames} from '../graph/use_graph_option_names';

export {computeAssignmentPrefetch, assignmentFallbackLabels};

export type AssignmentGraphPickerProps = {
    field: GraphFieldRef;
    ids: string[];
    onIdsChange: (ids: string[]) => void;
    disabled?: boolean;
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
    ...chrome
}: AssignmentGraphPickerProps) {
    const fallbackLabels = useMemo(() => assignmentFallbackLabels(field), [field]);

    const prefetchOnMount = useMemo(() => computeAssignmentPrefetch(field, ids), [field, ids]);

    const idsRef = useRef(ids);
    idsRef.current = ids;

    const joinRef = useRef<GraphOptionJoin | null>(null);

    const handleOptionsLoaded = useCallback((join: GraphOptionJoin) => {
        joinRef.current = join;
        commitGraphOptionNames(field.id, graphJoinNames(join));
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

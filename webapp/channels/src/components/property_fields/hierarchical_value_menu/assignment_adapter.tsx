// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import HierarchicalValueMenu from './hierarchical_value_menu';
import type {HierarchicalValueMenuField, HierarchicalValueMenuProps} from './hierarchical_value_menu';

/** True when chips cannot be named from the inlined option list. */
export function computeAssignmentPrefetch(field: HierarchicalValueMenuField, ids: string[]): boolean {
    if (field.attrs?.options_omitted) {
        return true;
    }

    const options = field.attrs?.options ?? [];
    return ids.some((id) => !options.some((option) => option.id === id));
}

/** id -> name from the field payload, for chips before the first fetch lands. */
export function assignmentFallbackLabels(field: HierarchicalValueMenuField): Record<string, string> {
    const labels: Record<string, string> = {};
    for (const option of field.attrs?.options ?? []) {
        if (option.id) {
            labels[option.id] = option.name;
        }
    }
    return labels;
}

export type AssignmentHierarchicalValuesProps = {
    field: HierarchicalValueMenuField;
    ids: string[];
    onIdsChange: (ids: string[]) => void;
    disabled?: boolean;

    prefetchOnMount?: boolean;
} & Pick<
    HierarchicalValueMenuProps,
'menuId' | 'buttonId' | 'buttonDataTestId' | 'placeholder' | 'ariaLabel' |
'className' | 'buttonClassName' | 'trailingChips' | 'extraMenuItems'
>;

export default function AssignmentHierarchicalValues({
    field,
    ids,
    onIdsChange,
    disabled,
    prefetchOnMount,
    ...chrome
}: AssignmentHierarchicalValuesProps) {
    const fallbackLabels = useMemo(() => assignmentFallbackLabels(field), [field]);

    const shouldPrefetch = prefetchOnMount ?? computeAssignmentPrefetch(field, ids);

    return (
        <HierarchicalValueMenu
            {...chrome}
            field={field}
            selectedIds={ids}
            onSelectedIdsChange={onIdsChange}
            disabled={disabled}
            fallbackLabels={fallbackLabels}
            prefetchOnMount={shouldPrefetch}
        />
    );
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import HierarchicalValueMenu from './hierarchical_value_menu';
import type {HierarchicalValueMenuProps} from './hierarchical_value_menu';

import type {GraphOptionJoin} from '../graph';
import {emitIdToName, hydrateNameToId, joinGraphOptions} from '../graph';

/** Policy names → tree ids. An unresolved name stands in as its own id so the rule does not shrink. */
export function hydratePolicyNamesToIds(
    names: string[],
    byExactName: Map<string, PropertyFieldOption>,
): {ids: string[]; fallbackLabels: Record<string, string>} {
    const ids: string[] = [];
    const fallbackLabels: Record<string, string> = {};
    const seen = new Set<string>();

    for (const name of names) {
        const resolved = hydrateNameToId(name, byExactName);
        const id = resolved ?? name;

        fallbackLabels[id] = name;

        if (!seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    }

    return {ids, fallbackLabels};
}

/** Tree ids → policy names. Missing options emit the last known name, then the id. */
export function emitPolicyIdsToNames(
    ids: string[],
    byId: Map<string, PropertyFieldOption>,
    fallbackLabels: Record<string, string>,
): string[] {
    const names: string[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
        const name = emitIdToName(id, byId, fallbackLabels[id]);
        if (!seen.has(name)) {
            seen.add(name);
            names.push(name);
        }
    }

    return names;
}

export type PolicyHierarchicalValuesProps = {
    field: HierarchicalValueMenuProps['field'];
    names: string[];
    onNamesChange: (names: string[]) => void;
    disabled?: boolean;
} & Pick<
    HierarchicalValueMenuProps,
'menuId' | 'buttonId' | 'buttonDataTestId' | 'placeholder' | 'ariaLabel' |
'className' | 'buttonClassName' | 'trailingChips' | 'extraMenuItems'
>;

export default function PolicyHierarchicalValues({
    field,
    names,
    onNamesChange,
    disabled,
    ...chrome
}: PolicyHierarchicalValuesProps) {
    const [fetchedJoin, setFetchedJoin] = useState<GraphOptionJoin | null>(null);

    const payloadJoin = useMemo(
        () => joinGraphOptions(field.attrs?.options ?? []),
        [field.attrs?.options],
    );

    const join = fetchedJoin ?? payloadJoin;

    const {ids, fallbackLabels} = useMemo(
        () => hydratePolicyNamesToIds(names, join.byExactName),
        [names, join],
    );

    const handleIdsChange = useCallback((nextIds: string[]) => {
        onNamesChange(emitPolicyIdsToNames(nextIds, join.byId, fallbackLabels));
    }, [join, fallbackLabels, onNamesChange]);

    const handleOptionsLoaded = useCallback((loaded: GraphOptionJoin) => {
        setFetchedJoin(loaded);
    }, []);

    return (
        <HierarchicalValueMenu
            {...chrome}
            field={field}
            selectedIds={ids}
            onSelectedIdsChange={handleIdsChange}
            disabled={disabled}
            fallbackLabels={fallbackLabels}
            onOptionsLoaded={handleOptionsLoaded}
            prefetchOnMount={false}
        />
    );
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import HierarchicalValueMenu from './hierarchical_value_menu';
import type {HierarchicalValueMenuProps} from './hierarchical_value_menu';

import type {GraphOptionJoin} from '../graph_option_tree';
import {emitIdToName, hydrateNameToId, joinGraphOptions} from '../graph_option_tree';

/**
 * Option names as a policy row holds them, turned into the value ids the tree
 * selects by.
 *
 * A name that resolves to nothing is a stale selection: a renamed option, a
 * deleted one, or one outside a shared_only coverage subset. It stands in as its
 * own id so the chip keeps its text, the checkbox stays checked, and the name is
 * still emitted -- a policy's rule must never shrink because a read was partial.
 */
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

        // Last known name for this id, which is what the chip falls back to once
        // the option itself is gone.
        fallbackLabels[id] = name;

        if (!seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    }

    return {ids, fallbackLabels};
}

/**
 * Value ids back to the option names a policy row stores. The rule compiles
 * names, so an id with no option must still emit something: the last known name,
 * and failing that the id itself, which for a stale selection is the original
 * name.
 */
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

/**
 * The policy editor's view of the tree: names in, names out. It does not fetch --
 * the widget owns that -- so it hydrates against the field payload's flat option
 * list until the widget reports a fetched one.
 */
export default function PolicyHierarchicalValues({
    field,
    names,
    onNamesChange,
    disabled,
    ...chrome
}: PolicyHierarchicalValuesProps) {
    const [fetchedJoin, setFetchedJoin] = useState<GraphOptionJoin | null>(null);

    // attrs.options is parentless, so it is useless as a tree -- but whenever the
    // field payload inlined it, it is a complete name<->id map, which is what
    // lets an existing row render checked before the menu is ever opened.
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
        // The last uncheck emits []. The policy parent then omits the row, this
        // component unmounts, and the widget's unmount cleanup aborts the walk.
        onNamesChange(emitPolicyIdsToNames(nextIds, join.byId, fallbackLabels));
    }, [join, fallbackLabels, onNamesChange]);

    // Memoised: an unstable identity makes the widget re-announce its join on
    // every render, and each announce sets state here.
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

            // Policy chips are already names on the row, so there is nothing to
            // prefetch for them. The tree still pages on menu open, like every
            // other graph.
            prefetchOnMount={false}
        />
    );
}

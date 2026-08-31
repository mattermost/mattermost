// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

// One row of the hit-split tree. A value with several parents produces one
// occurrence per parent, all sharing one valueId: selection is by value id, so
// checking any occurrence checks them all.
export type GraphOccurrence = {

    // `${parentId ?? ''}::${valueId}`, an empty parent segment for a root.
    //
    // Unique among siblings but NOT a node identity: a value whose parent has
    // several occurrences has one occurrence per parent occurrence, and they
    // all carry this same key. Safe as a sibling-list React key, and safe as an
    // expand/collapse key precisely because occurrences sharing a key should
    // open together -- opening one `s::t` opens every `s::t` -- but never as a
    // tree-wide unique id, and never to address one specific row.
    occKey: string;

    // Identity. Selection, `{n} inside` counts and expand-to-selected are all
    // keyed on this, never on occKey.
    valueId: string;
    parentId: string | null;
    label: string;

    // The names of this value's other parents, in the order the server reported
    // them. Empty for a value with one parent or none. Already server-ordered;
    // do not sort.
    alsoUnder: string[];

    // Empty for a leaf, and also empty for an occurrence whose expansion hit
    // the occurrence budget -- a truncated row looks childless. Do not read
    // emptiness as "this value has no children"; `flattenSearch` still finds
    // and selects values whose occurrences were cut.
    children: GraphOccurrence[];
};

// One flat search result. One row per value id rather than per occurrence.
export type GraphSearchRow = {
    valueId: string;
    label: string;

    // Pre-rendered, e.g. `A › B › C` or `A › B · +2` when the value hangs under
    // two further paths. Empty for a value with no resolved parents. Do not
    // append to it.
    //
    // This is the first-parent chain, not necessarily a path from a root: it
    // stops early at a dangling parent or a cycle, so it can begin mid-graph.
    path: string;
};

export type GraphOptionJoin = {
    byId: Map<string, PropertyFieldOption>;

    // Exact and case-sensitive: `Engineering` and `engineering` are different
    // options. First wins on a duplicate name.
    byExactName: Map<string, PropertyFieldOption>;

    // One occurrence per root option, in input order. Every root option is
    // always seated, even when the occurrence budget is spent, so this is the
    // complete set of top-level options. Truncation costs subtrees rather than
    // rows: a root beyond the budget appears with empty `children`.
    roots: GraphOccurrence[];
};

// A chain longer than this cannot exist: the server holds a graph field's
// hierarchy to PropertyGraphMaxDepth options on one chain, counting the root.
const MAX_OCCURRENCE_DEPTH = 100;

// Occurrences are root-to-value paths, and the server's limits do not bound
// those: 100 layers of two options, each below both options of the layer above,
// is 200 options and 398 edges -- inside every server limit -- and 2^99 paths.
// So expansion is budgeted. The budget scales with the option list so that no
// graph averaging four paths per value is ever truncated, and truncation is
// safe: search matches the flat option list rather than the tree, so a value
// whose occurrence was cut is still findable and still selectable.
const MIN_OCCURRENCE_BUDGET = 5000;
const OCCURRENCE_BUDGET_PER_OPTION = 4;

// A value's extra-path count is only ever rendered, so it saturates rather than
// multiplying out a diamond-heavy graph.
const MAX_EXTRA_PATHS = 99;

const PATH_SEPARATOR = ' › ';
const EXTRA_PATHS_SEPARATOR = ' · ';

// Copied from admin_console/global_attributes/attribute_details/graph_utils.ts
// (190-201) rather than imported: Account Settings renders this tree and must
// not depend on the Manage Attributes authoring module.
function oxfordJoinNames(names: string[]): string {
    if (names.length === 0) {
        return '';
    }
    if (names.length === 1) {
        return names[0];
    }
    if (names.length === 2) {
        return `${names[0]} and ${names[1]}`;
    }
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function occKeyFor(parentId: string | null, valueId: string): string {
    return `${parentId ?? ''}::${valueId}`;
}

// The id-keyed shape of an option list, without the occurrence tree. Sibling and
// parent order both come straight from the input: the option list arrives in
// creation order and each option's parents arrive in the order the server
// reported them, and neither is re-sorted here.
type GraphIndex = {
    byId: Map<string, PropertyFieldOption>;
    byExactName: Map<string, PropertyFieldOption>;
    parentIdsByChildId: Map<string, string[]>;
    childIdsByParentId: Map<string, string[]>;
    rootIds: string[];

    // Every distinct option id, in input order.
    order: string[];
};

// Two passes, because a parent may appear after its child: options created in one
// payload share a creation time and are ordered by id.
function indexOptions(options: PropertyFieldOption[]): GraphIndex {
    const byId = new Map<string, PropertyFieldOption>();
    const byExactName = new Map<string, PropertyFieldOption>();
    const order: string[] = [];

    for (const option of options) {
        if (!byId.has(option.id)) {
            byId.set(option.id, option);
            order.push(option.id);
        }
        if (!byExactName.has(option.name)) {
            byExactName.set(option.name, option);
        }
    }

    const parentIdsByChildId = new Map<string, string[]>();
    const childIdsByParentId = new Map<string, string[]>();
    const rootIds: string[] = [];

    for (const childId of order) {
        const option = byId.get(childId) as PropertyFieldOption;
        const parentIds: string[] = [];

        // A parent name that resolves to nothing, to this option itself, or to a
        // parent already resolved is dropped rather than reported: an option left
        // with no parents is a root, which is a legitimate place for one to be.
        for (const parentName of option.parents ?? []) {
            const parent = byExactName.get(parentName);
            if (!parent || parent.id === childId || parentIds.includes(parent.id)) {
                continue;
            }
            parentIds.push(parent.id);
        }
        parentIdsByChildId.set(childId, parentIds);

        if (parentIds.length === 0) {
            rootIds.push(childId);
            continue;
        }
        for (const parentId of parentIds) {
            const siblings = childIdsByParentId.get(parentId);
            if (siblings) {
                siblings.push(childId);
            } else {
                childIdsByParentId.set(parentId, [childId]);
            }
        }
    }

    return {byId, byExactName, parentIdsByChildId, childIdsByParentId, rootIds, order};
}

export function joinGraphOptions(options: PropertyFieldOption[]): GraphOptionJoin {
    const index = indexOptions(options);
    const budget = Math.max(MIN_OCCURRENCE_BUDGET, options.length * OCCURRENCE_BUDGET_PER_OPTION);
    let emitted = 0;

    // ancestors holds the value ids on the path to this occurrence, so a cycle
    // cuts without dropping a diamond: a value legitimately appears once per
    // parent, and only a value already above itself on this path is skipped.
    const expand = (valueId: string, parentId: string | null, depth: number, ancestors: Set<string>): GraphOccurrence => {
        const parentIds = index.parentIdsByChildId.get(valueId) ?? [];
        const occurrence: GraphOccurrence = {
            occKey: occKeyFor(parentId, valueId),
            valueId,
            parentId,
            label: index.byId.get(valueId)?.name ?? valueId,
            alsoUnder: parentIds.
                filter((id) => id !== parentId).
                map((id) => index.byId.get(id)?.name ?? id),
            children: [],
        };
        emitted++;

        if (depth >= MAX_OCCURRENCE_DEPTH || emitted >= budget) {
            return occurrence;
        }

        ancestors.add(valueId);
        for (const childId of index.childIdsByParentId.get(valueId) ?? []) {
            if (ancestors.has(childId)) {
                continue;
            }
            occurrence.children.push(expand(childId, valueId, depth + 1, ancestors));
            if (emitted >= budget) {
                break;
            }
        }
        ancestors.delete(valueId);

        return occurrence;
    };

    // Every root is seated even once the budget is spent: expand's own early
    // return makes each further root a childless stub, so the budget bounds
    // cost without ever dropping a top-level row. Overshoot is at most one
    // occurrence per root.
    const roots: GraphOccurrence[] = [];
    for (const rootId of index.rootIds) {
        roots.push(expand(rootId, null, 1, new Set<string>()));
    }

    return {byId: index.byId, byExactName: index.byExactName, roots};
}

// An empty id is a miss: an option list can carry options whose id was never a
// generated identifier, and a falsy id must not reach a selection set.
export function hydrateNameToId(name: string, byExactName: Map<string, PropertyFieldOption>): string | undefined {
    const id = byExactName.get(name)?.id;
    return id || undefined;
}

export function emitIdToName(id: string, byId: Map<string, PropertyFieldOption>, fallback?: string): string {
    const name = byId.get(id)?.name;
    if (name) {
        return name;
    }
    if (fallback) {
        return fallback;
    }
    return id;
}

// The chain of parent names above a value, following each option's first parent.
// The server reports an option's parents in a fixed order, so this is stable
// across reads. Cycle-guarded and depth-capped.
function firstParentPath(valueId: string, index: GraphIndex): string {
    const labels: string[] = [];
    const onPath = new Set<string>([valueId]);
    let current = valueId;

    for (let step = 0; step < MAX_OCCURRENCE_DEPTH; step++) {
        const parentId = (index.parentIdsByChildId.get(current) ?? [])[0];
        if (parentId === undefined || onPath.has(parentId)) {
            break;
        }
        onPath.add(parentId);
        labels.push(index.byId.get(parentId)?.name ?? parentId);
        current = parentId;
    }

    return labels.reverse().join(PATH_SEPARATOR);
}

// How many root-to-value paths a value hangs under, saturating at
// MAX_EXTRA_PATHS + 1. Memoised, so it is linear over the hierarchy rather than
// multiplying a diamond out. A value already on the current path contributes no
// path, which cuts a cycle; in a cyclic input the count is a lower bound, which
// only ever understates a rendered "+N".
function countRootPaths(valueId: string, index: GraphIndex, memo: Map<string, number>, onPath: Set<string>): number {
    const cached = memo.get(valueId);
    if (cached !== undefined) {
        return cached;
    }
    if (onPath.has(valueId)) {
        return 0;
    }

    const parentIds = index.parentIdsByChildId.get(valueId) ?? [];
    if (parentIds.length === 0) {
        memo.set(valueId, 1);
        return 1;
    }

    onPath.add(valueId);
    let total = 0;
    for (const parentId of parentIds) {
        total += countRootPaths(parentId, index, memo, onPath);
        if (total > MAX_EXTRA_PATHS) {
            total = MAX_EXTRA_PATHS + 1;
            break;
        }
    }
    onPath.delete(valueId);

    memo.set(valueId, total);
    return total;
}

// Flat, one row per value id, matching on label rather than on the hierarchy.
// Row order is the input order, which is the field's creation order.
export function flattenSearch(options: PropertyFieldOption[], query: string): GraphSearchRow[] {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
        return [];
    }

    const index = indexOptions(options);
    const memo = new Map<string, number>();
    const rows: GraphSearchRow[] = [];

    for (const valueId of index.order) {
        const option = index.byId.get(valueId) as PropertyFieldOption;
        if (!option.name.toLowerCase().includes(needle)) {
            continue;
        }

        const path = firstParentPath(valueId, index);
        const paths = Math.max(1, countRootPaths(valueId, index, memo, new Set<string>()));
        const extra = paths - 1;

        rows.push({
            valueId,
            label: option.name,
            path: extra > 0 ? `${path}${EXTRA_PATHS_SEPARATOR}+${extra}` : path,
        });
    }

    return rows;
}

// The occurrences that have to be open for every selected value to be visible,
// and no others. A selected occurrence is not opened for its own sake -- it is
// already visible once its ancestors are -- so only an occurrence holding a
// selected value below it is returned.
//
// `selectedIds` holds value ids, never occKeys. The returned set holds occKeys,
// and because those are not node identities one entry can open more than one
// row; that is intended, since every path to a checked value should open.
//
// Requires occurrence objects to be node-unique: no single object may sit at two
// positions in `roots`. `joinGraphOptions` guarantees it, allocating a fresh
// occurrence per node even for a value reached through several parents, and
// `allocates a distinct occurrence object for every node` pins that. A caller
// that memoises or otherwise reuses occurrence objects across tree positions
// breaks the cycle guard below and silently under-opens ancestor paths.
export function expandToSelected(roots: GraphOccurrence[], selectedIds: Set<string>): Set<string> {
    const open = new Set<string>();
    if (selectedIds.size === 0) {
        return open;
    }

    // Keyed on the node rather than on its occKey: occKey is not a node
    // identity, because a value whose parent has several occurrences has one
    // occurrence per parent occurrence and they all share the one key. Keying
    // on occKey here would prune every occurrence after the first and leave
    // the other ancestor paths to a checked value collapsed. Expansion
    // allocates a fresh occurrence per node, so this only stops a caller's
    // hand-built cycle from recursing.
    const visited = new Set<GraphOccurrence>();

    const walk = (node: GraphOccurrence): boolean => {
        if (visited.has(node)) {
            return false;
        }
        visited.add(node);

        let holdsSelected = false;
        for (const child of node.children) {
            if (walk(child)) {
                holdsSelected = true;
            }
        }
        if (holdsSelected) {
            open.add(node.occKey);
        }

        return holdsSelected || selectedIds.has(node.valueId);
    };

    for (const root of roots) {
        walk(root);
    }

    return open;
}

// How many selected values sit below an occurrence, counted by value id: a value
// reachable by two paths under the same ancestor counts once. Seeding the seen
// set with the node itself both excludes it from its own count and stops a cycle,
// and the same set is what keeps a diamond linear.
//
// `selectedIds` holds value ids, never occKeys. The count covers this
// occurrence's own subtree only, so a truncated subtree undercounts.
export function selectedDescendantCount(node: GraphOccurrence, selectedIds: Set<string>): number {
    if (selectedIds.size === 0) {
        return 0;
    }

    const seen = new Set<string>([node.valueId]);
    const pending = [...node.children];
    let count = 0;

    while (pending.length > 0) {
        const current = pending.pop() as GraphOccurrence;
        if (seen.has(current.valueId)) {
            continue;
        }
        seen.add(current.valueId);
        if (selectedIds.has(current.valueId)) {
            count++;
        }
        for (const child of current.children) {
            pending.push(child);
        }
    }

    return count;
}

// The other parents of an occurrence's value, joined for display. The caller
// supplies the surrounding copy: this module has no i18n.
export function alsoUnderLabel(otherParentNames: string[]): string {
    return oxfordJoinNames(otherParentNames);
}

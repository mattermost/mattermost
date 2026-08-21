// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {
    GRAPH_MAX_EDGES,
    GRAPH_MAX_OPTIONS,
    GRAPH_MAX_PARENTS_PER_VALUE,
} from '../constants';

import {
    GRAPH_CYCLE_ERROR_DEFAULT,
    GRAPH_DEPTH_ERROR_DEFAULT,
    GRAPH_MAX_PARENTS_ERROR_DEFAULT,
    GRAPH_UNIQUENESS_ERROR_DEFAULT,
    addChildOption,
    addParentEdge,
    addTopLevelOption,
    checkParentEdge,
    computeDepthAfterAdd,
    countEdges,
    cycleErrorValues,
    depthErrorValues,
    findAncestors,
    findNewlyReachableDescendants,
    findOrphansAfterDelete,
    getChildren,
    getRoots,
    hasBlankTrimmedOptionName,
    hasCaseInsensitiveDuplicateNames,
    isNameUnique,
    oxfordJoinNames,
    removeOption,
    removeParentEdge,
    renameOption,
    replaceOccurrenceParent,
    uniquenessErrorValues,
    wouldCreateCycle,
    wouldExceedMaxEdges,
    wouldExceedMaxOptions,
    wouldExceedMaxParents,
} from './graph_utils';

const opt = (name: string, parents: string[] = []): PropertyFieldOption => ({id: '', name, parents});

const names = (options: PropertyFieldOption[]) => options.map((o) => o.name);

const sorted = (values: string[]) => [...values].sort();

const freezeGraph = (options: PropertyFieldOption[]): PropertyFieldOption[] => {
    return Object.freeze(options.map((option) => Object.freeze({
        ...option,
        parents: option.parents ? Object.freeze([...option.parents]) : option.parents,
    })));
};

// Spike fixture table (required assertions):
// | Helper                         | Fixture                                      | Expected |
// | computeDepthAfterAdd           | Root→child A:[] add B under A                | 2 |
// | computeDepthAfterAdd           | Diamond close C→D on A→B→D, A→C              | 3 (not 4) |
// | computeDepthAfterAdd           | Uneven D.parents=[B,E] through E→D           | 4 (not first-parent 3) |
// | computeDepthAfterAdd           | Sibling S under A on A→B→C                   | 2 (not graph-wide 3) |
// | findNewlyReachableDescendants  | Reparent C from R onto ancestor P            | [] (vs_original) |
// | findNewlyReachableDescendants  | C has {R,S}, reparent R→P                    | ['D'] |
// | findNewlyReachableDescendants  | Leaf C, add P                                | [] |
// | findNewlyReachableDescendants  | already_d: D already under P via X; add P→C  | [] |
// | findAncestors                  | Diamond D                                    | {A,B,C} |
// | checkParentEdge                | C.parents=['R','S'] propose S                | {ok:true, noOp:true} |
// | removeParentEdge               | Last parent B.parents=['A'] remove A         | parents: []; B in getRoots |

describe('computeDepthAfterAdd', () => {
    test('root plus new child is 2 (start-counts-as-1 on both halves)', () => {
        expect(computeDepthAfterAdd([opt('A')], 'B', 'A')).toBe(2);
    });

    test('closing a diamond is 3, not unique-ancestor 4 (G2)', () => {
        const beforeClose = [opt('A'), opt('B', ['A']), opt('C', ['A']), opt('D', ['B'])];
        expect(computeDepthAfterAdd(beforeClose, 'D', 'C')).toBe(3);

        // trap: unique ancestors of D after close = {A,B,C} + D = 4
    });

    test('uneven diamond through the long arm is 4, not first-parent 3 (G2)', () => {
        const uneven = [
            opt('A'),
            opt('B', ['A']),
            opt('C', ['A']),
            opt('E', ['C']),
            opt('D', ['B', 'E']), // parents[0] is the SHORT arm
        ];
        expect(uneven.find((o) => o.name === 'D')!.parents![0]).toBe('B');
        expect(computeDepthAfterAdd(uneven, 'D', 'E')).toBe(4);
        expect(computeDepthAfterAdd(uneven, 'D', 'B')).toBe(3);
    });

    test('sibling add under a depth-3 chain is 2, not graph-wide 3 (G2)', () => {
        const chain3 = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        expect(computeDepthAfterAdd(chain3, 'S', 'A')).toBe(2);

        // trap: longest chain of the whole graph after add is still 3 (A-B-C)
    });

    test('remove-then-add measures the chain that remains (server DepthAfterAdding)', () => {
        // Air → Fighter Jet → F-18; add Trainer under F-18 while lifting F-18 to a root.
        // Server DepthAfterAdding can remove F-18→Fighter Jet in the same payload as
        // adding Trainer→F-18 (different children). UI removeParent only edits childName,
        // so lift F-18 first — same hierarchy the server measures.
        const options = [
            opt('Air'),
            opt('Fighter Jet', ['Air']),
            opt('F-18', ['Fighter Jet']),
            opt('Trainer'),
        ];
        expect(computeDepthAfterAdd(options, 'Trainer', 'F-18')).toBe(4);
        const lifted = removeParentEdge(options, 'F-18', 'Fighter Jet');
        expect(computeDepthAfterAdd(lifted, 'Trainer', 'F-18')).toBe(2);
    });

    test('occurrence-replace still uses through-edge depth (G2)', () => {
        const options = [opt('A'), opt('B', ['A']), opt('C', ['B']), opt('P')];
        expect(computeDepthAfterAdd(options, 'C', 'P')).toBe(2);
        expect(computeDepthAfterAdd(options, 'C', 'P', {removeParent: 'B'})).toBe(2);
    });
});

describe('findNewlyReachableDescendants', () => {
    test('reparent onto ancestor is empty (vs_original; after_remove would over-confirm) (G3)', () => {
        const shortcut = [opt('P'), opt('R', ['P']), opt('C', ['R']), opt('D', ['C'])];
        expect(sorted(findNewlyReachableDescendants(shortcut, 'C', 'P', {removeParent: 'R'}))).toEqual([]);

        // trap: after_remove baseline = {C, D}
    });

    test('reparent R→P while C keeps S matches add (descendants-only D)', () => {
        const remaining = [opt('R'), opt('S'), opt('P'), opt('C', ['R', 'S']), opt('D', ['C'])];
        expect(sorted(findNewlyReachableDescendants(remaining, 'C', 'P'))).toEqual(['D']);
        expect(sorted(findNewlyReachableDescendants(remaining, 'C', 'P', {removeParent: 'R'}))).toEqual(['D']);
    });

    test('leaf add lists no descendants (no grant-confirm) (G13)', () => {
        expect(findNewlyReachableDescendants([opt('P'), opt('C')], 'C', 'P')).toEqual([]);
    });

    test('already_d: only the child is new to P, descendants-only is empty (G13)', () => {
        const alreadyD = [
            opt('P'),
            opt('X', ['P']),
            opt('R'),
            opt('C', ['R']),
            opt('D', ['X', 'C']),
        ];
        expect(sorted(findNewlyReachableDescendants(alreadyD, 'C', 'P'))).toEqual([]);
        expect(sorted(findNewlyReachableDescendants(alreadyD, 'C', 'P', {removeParent: 'R'}))).toEqual([]);

        // including-child newly would be {C}; that must NOT open the modal
    });

    test('isolated add of C (which has D) lists D only', () => {
        const isolated = [opt('P'), opt('C'), opt('D', ['C'])];
        expect(sorted(findNewlyReachableDescendants(isolated, 'C', 'P'))).toEqual(['D']);
    });

    test('shortcut add (P already reaches C via R) is empty', () => {
        const shortcut = [opt('P'), opt('R', ['P']), opt('C', ['R']), opt('D', ['C'])];
        expect(findNewlyReachableDescendants(shortcut, 'C', 'P')).toEqual([]);
    });

    test('shared ancestor: add P→C newly reaches D', () => {
        const shared = [
            opt('Shared'),
            opt('P', ['Shared']),
            opt('R', ['Shared']),
            opt('C', ['R']),
            opt('D', ['C']),
        ];
        expect(sorted(findNewlyReachableDescendants(shared, 'C', 'P'))).toEqual(['D']);
        expect(sorted(findNewlyReachableDescendants(shared, 'C', 'P', {removeParent: 'R'}))).toEqual(['D']);
    });
});

describe('findAncestors', () => {
    const diamond = [opt('A'), opt('B', ['A']), opt('C', ['A']), opt('D', ['B', 'C'])];

    test('diamond D is {A,B,C} strict (server AncestorsOrSelf also includes D)', () => {
        expect(sorted(findAncestors(diamond, 'D'))).toEqual(['A', 'B', 'C']);
        expect(findAncestors(diamond, 'A')).toEqual([]);
    });
});

describe('checkParentEdge', () => {
    test('self is error self, not cycle', () => {
        expect(checkParentEdge([opt('A')], 'A', 'A')).toEqual({ok: false, error: 'self'});
    });

    test('parent already held via another occurrence is silent noOp (G4)', () => {
        const options = [opt('R'), opt('S'), opt('C', ['R', 'S'])];
        expect(checkParentEdge(options, 'C', 'S')).toEqual({ok: true, noOp: true});
        expect(checkParentEdge(options, 'C', 'S')).not.toHaveProperty('error');
        expect(checkParentEdge(options, 'C', 'S', {removeParent: 'R'})).toEqual({ok: true, noOp: true});
    });

    test('cycle A→B→C plus C→A', () => {
        const chain = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        expect(checkParentEdge(chain, 'A', 'C')).toEqual({ok: false, error: 'cycle'});
    });

    test('happy path omits noOp and lists descendants-only newly reachable', () => {
        const isolated = [opt('P'), opt('C'), opt('D', ['C'])];
        const result = checkParentEdge(isolated, 'C', 'P');
        expect(result).toEqual({
            ok: true,
            newlyReachable: ['D'],
            ancestorsOfParent: [],
        });
        expect(result).not.toEqual(expect.objectContaining({noOp: true}));
    });

    test('replace at 100 parents is not max-parents (G16)', () => {
        const parentNames = Array.from({length: GRAPH_MAX_PARENTS_PER_VALUE}, (_, i) => `P${i}`);
        const options = [opt('Child', parentNames), ...parentNames.map((name) => opt(name)), opt('New')];
        const result = checkParentEdge(options, 'Child', 'New', {removeParent: 'P0'});
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result).not.toEqual(expect.objectContaining({noOp: true}));
        }
    });
});

describe('removeParentEdge', () => {
    test('last parent makes a root (G9)', () => {
        const options = freezeGraph([opt('A'), opt('B', ['A'])]);
        const next = removeParentEdge(options, 'B', 'A');
        expect(next.find((o) => o.name === 'B')?.parents).toEqual([]);
        expect(names(getRoots(next))).toEqual(['A', 'B']);
        expect(options.find((o) => o.name === 'B')?.parents).toEqual(['A']);
    });

    test('does not mutate the input array', () => {
        const options = freezeGraph([opt('A'), opt('B', ['A', 'C'])]);
        removeParentEdge(options, 'B', 'A');
        expect(options.find((o) => o.name === 'B')?.parents).toEqual(['A', 'C']);
    });
});

describe('isNameUnique', () => {
    const options = [opt('Alpha'), opt('Bravo')];

    test('exact duplicate is not unique', () => {
        expect(isNameUnique(options, 'Alpha')).toBe(false);
        expect(isNameUnique(options, 'Charlie')).toBe(true);
    });

    test('case-insensitive', () => {
        expect(isNameUnique(options, 'alpha')).toBe(false);
        expect(isNameUnique(options, 'ALPHA')).toBe(false);
    });

    test('trims candidate and stored names', () => {
        expect(isNameUnique(options, '  Alpha  ')).toBe(false);
        expect(isNameUnique([opt('  Bravo  ')], 'Bravo')).toBe(false);
    });

    test('excludeName allows rename to the same option', () => {
        expect(isNameUnique(options, 'Alpha', 'Alpha')).toBe(true);
        expect(isNameUnique(options, 'alpha', 'Alpha')).toBe(true);
        expect(isNameUnique(options, 'Bravo', 'Alpha')).toBe(false);
    });

    test('empty list is unique', () => {
        expect(isNameUnique([], 'Alpha')).toBe(true);
    });
});

describe('hasCaseInsensitiveDuplicateNames', () => {
    test('empty list has no duplicates', () => {
        expect(hasCaseInsensitiveDuplicateNames([])).toBe(false);
    });

    test('distinct names are not duplicates', () => {
        expect(hasCaseInsensitiveDuplicateNames([opt('A'), opt('B')])).toBe(false);
    });

    test('exact duplicate names', () => {
        expect(hasCaseInsensitiveDuplicateNames([opt('A'), opt('A')])).toBe(true);
    });

    test('case-insensitive duplicates', () => {
        expect(hasCaseInsensitiveDuplicateNames([opt('Alpha'), opt('alpha')])).toBe(true);
    });

    test('trimmed names are duplicates', () => {
        expect(hasCaseInsensitiveDuplicateNames([opt('  Bravo  '), opt('Bravo')])).toBe(true);
    });

    test('single option is not a duplicate', () => {
        expect(hasCaseInsensitiveDuplicateNames([opt('A')])).toBe(false);
    });
});

describe('hasBlankTrimmedOptionName', () => {
    test('empty list has no blank names', () => {
        expect(hasBlankTrimmedOptionName([])).toBe(false);
    });

    test('named option is not blank', () => {
        expect(hasBlankTrimmedOptionName([opt('A')])).toBe(false);
    });

    test('empty string is blank', () => {
        expect(hasBlankTrimmedOptionName([opt('')])).toBe(true);
    });

    test('whitespace-only name is blank', () => {
        expect(hasBlankTrimmedOptionName([opt('   ')])).toBe(true);
    });

    test('blank among named options', () => {
        expect(hasBlankTrimmedOptionName([opt('A'), opt('  ')])).toBe(true);
    });
});

describe('wouldCreateCycle', () => {
    test('A→B→C plus C→A', () => {
        const chain = [opt('A'), opt('B', ['A']), opt('C', ['B'])];

        // Proposing parentName=C as a parent of childName=A is a cycle (A already grants C).
        expect(wouldCreateCycle(chain, 'A', 'C')).toBe(true);

        // Proposing parentName=A as a parent of childName=C is not: A already grants C.
        expect(wouldCreateCycle(chain, 'C', 'A')).toBe(false);
    });

    test('diamond close is not a cycle', () => {
        const beforeClose = [opt('A'), opt('B', ['A']), opt('C', ['A']), opt('D', ['B'])];
        expect(wouldCreateCycle(beforeClose, 'D', 'C')).toBe(false);
    });

    test('self-parent is a cycle at this layer', () => {
        expect(wouldCreateCycle([opt('A')], 'A', 'A')).toBe(true);
    });

    test('inverting an edge is a cycle unless the old edge is removed first', () => {
        const ab = [opt('A'), opt('B', ['A'])];
        expect(wouldCreateCycle(ab, 'A', 'B')).toBe(true);

        // Server WouldCreateCycle can drop A→B while adding B→A in one payload
        // (different children). UI removeParent only edits childName, so remove
        // the old edge first — same end state as the server.
        expect(wouldCreateCycle(removeParentEdge(ab, 'B', 'A'), 'A', 'B')).toBe(false);
    });
});

describe('wouldExceedMaxParents', () => {
    const nParents = (n: number) => Array.from({length: n}, (_, i) => `P${i}`);

    test('99 add is allowed; 100 add is not; replace at 100 does not bump (G16)', () => {
        const at99 = [opt('Child', nParents(GRAPH_MAX_PARENTS_PER_VALUE - 1))];
        const at100 = [opt('Child', nParents(GRAPH_MAX_PARENTS_PER_VALUE))];
        expect(wouldExceedMaxParents(at99, 'Child')).toBe(false);
        expect(wouldExceedMaxParents(at100, 'Child')).toBe(true);
        expect(wouldExceedMaxParents(at100, 'Child', {replacingParent: 'P0'})).toBe(false);
        expect(wouldExceedMaxParents(at100, 'Child', {replacingParent: null})).toBe(true);
    });
});

describe('findOrphansAfterDelete', () => {
    test('single-parent child is an orphan; multi-parent child is not', () => {
        const options = [
            opt('X'),
            opt('Keep'),
            opt('Orphan', ['X']),
            opt('Shared', ['X', 'Keep']),
            opt('Grand', ['Orphan']),
        ];
        expect(names(findOrphansAfterDelete(options, 'X'))).toEqual(['Orphan']);
        expect(names(findOrphansAfterDelete(options, 'Keep'))).toEqual([]);
    });
});

describe('renameOption', () => {
    test('renames the option and every parents entry', () => {
        const options = freezeGraph([opt('Old'), opt('Kid', ['Old']), opt('Other', ['Old', 'Kid'])]);
        const next = renameOption(options, 'Old', '  New  ');
        expect(next.find((o) => o.name === 'New')).toEqual({id: '', name: 'New', parents: []});
        expect(next.find((o) => o.name === 'Kid')?.parents).toEqual(['New']);
        expect(next.find((o) => o.name === 'Other')?.parents).toEqual(['New', 'Kid']);
        expect(options.find((o) => o.name === 'Old')).toBeTruthy();
    });

    test('blank or whitespace rename is a no-op (G15)', () => {
        const options = [opt('Keep')];
        expect(renameOption(options, 'Keep', '')).toBe(options);
        expect(renameOption(options, 'Keep', '   ')).toBe(options);
    });

    test('does not mutate the input array', () => {
        const options = freezeGraph([opt('Old'), opt('Kid', ['Old'])]);
        renameOption(options, 'Old', 'New');
        expect(options.find((o) => o.name === 'Old')?.parents).toEqual([]);
        expect(options.find((o) => o.name === 'Kid')?.parents).toEqual(['Old']);
    });
});

describe('replaceOccurrenceParent', () => {
    test('keeps other parents and dedupes', () => {
        const options = freezeGraph([opt('R'), opt('S'), opt('P'), opt('C', ['R', 'S'])]);
        const next = replaceOccurrenceParent(options, 'C', 'R', 'P');
        expect(next.find((o) => o.name === 'C')?.parents).toEqual(['S', 'P']);
        expect(options.find((o) => o.name === 'C')?.parents).toEqual(['R', 'S']);
    });

    test('root occurrence (null old parent) appends without dropping others', () => {
        const options = [opt('P'), opt('C')];
        expect(replaceOccurrenceParent(options, 'C', null, 'P').find((o) => o.name === 'C')?.parents).toEqual(['P']);
    });

    test('does not mutate the input array', () => {
        const options = freezeGraph([opt('R'), opt('P'), opt('C', ['R'])]);
        replaceOccurrenceParent(options, 'C', 'R', 'P');
        expect(options.find((o) => o.name === 'C')?.parents).toEqual(['R']);
    });
});

describe('oxfordJoinNames', () => {
    test('1 / 2 / 3+ forms', () => {
        expect(oxfordJoinNames([])).toBe('');
        expect(oxfordJoinNames(['A'])).toBe('A');
        expect(oxfordJoinNames(['A', 'B'])).toBe('A and B');
        expect(oxfordJoinNames(['A', 'B', 'C'])).toBe('A, B, and C');
        expect(oxfordJoinNames(['A', 'B', 'C', 'D'])).toBe('A, B, C, and D');
    });
});

describe('copy helpers', () => {
    test('cycle values map parent=B, child=A', () => {
        expect(cycleErrorValues('B', 'A')).toEqual({parent: 'B', child: 'A'});
    });

    test('locked defaultMessage strings use option wording and literal 100', () => {
        expect(GRAPH_CYCLE_ERROR_DEFAULT).toBe(
            "{parent} can't be a parent of {child} — {child} already grants {parent}, so this would loop back on itself.",
        );
        expect(GRAPH_UNIQUENESS_ERROR_DEFAULT).toBe('"{name}" already exists in this field.');
        expect(GRAPH_DEPTH_ERROR_DEFAULT).toBe(
            'Adding this parent pushes "{name}" to depth {n}; the limit is 100.',
        );
        expect(GRAPH_MAX_PARENTS_ERROR_DEFAULT).toBe('An option can have at most 100 parents.');
        expect(uniquenessErrorValues('Alpha')).toEqual({name: 'Alpha'});
        expect(depthErrorValues('Alpha', 101)).toEqual({name: 'Alpha', n: 101});
    });
});

describe('query helpers', () => {
    const diamond = [opt('A'), opt('B', ['A']), opt('C', ['A']), opt('D', ['B', 'C'])];

    test('getChildren follows options order and missing parents', () => {
        expect(names(getChildren(diamond, 'A'))).toEqual(['B', 'C']);
        expect(names(getChildren(diamond, 'B'))).toEqual(['D']);
        expect(getChildren(diamond, 'D')).toEqual([]);
    });

    test('getRoots treats missing parents as a root', () => {
        expect(names(getRoots(diamond))).toEqual(['A']);
        expect(names(getRoots([{id: '', name: 'Lone'}]))).toEqual(['Lone']);
    });

    test('countEdges sums parent-list lengths', () => {
        expect(countEdges(diamond)).toBe(4);
        expect(countEdges([opt('A')])).toBe(0);
    });
});

describe('addTopLevelOption', () => {
    test('appends a root with parents: []', () => {
        const options = freezeGraph([opt('A')]);
        const next = addTopLevelOption(options, '  B  ');
        expect(next[next.length - 1]).toEqual({id: '', name: 'B', parents: []});
        expect(options).toHaveLength(1);
    });

    test('does not mutate the input array', () => {
        const options = freezeGraph([opt('A')]);
        addTopLevelOption(options, 'B');
        expect(names(options)).toEqual(['A']);
    });
});

describe('addChildOption', () => {
    test('appends a child with the given parent', () => {
        const options = freezeGraph([opt('A')]);
        const next = addChildOption(options, '  B  ', 'A');
        expect(next[next.length - 1]).toEqual({id: '', name: 'B', parents: ['A']});
    });

    test('does not mutate the input array', () => {
        const options = freezeGraph([opt('A')]);
        addChildOption(options, 'B', 'A');
        expect(options).toHaveLength(1);
    });
});

describe('addParentEdge', () => {
    test('appends a parent and dedupes', () => {
        const options = freezeGraph([opt('A'), opt('B'), opt('C', ['A'])]);
        expect(addParentEdge(options, 'C', 'B').find((o) => o.name === 'C')?.parents).toEqual(['A', 'B']);
        expect(addParentEdge(options, 'C', 'A').find((o) => o.name === 'C')?.parents).toEqual(['A']);
    });

    test('does not mutate the input array', () => {
        const options = freezeGraph([opt('A'), opt('B'), opt('C', ['A'])]);
        addParentEdge(options, 'C', 'B');
        expect(options.find((o) => o.name === 'C')?.parents).toEqual(['A']);
    });
});

describe('removeOption', () => {
    test('drops the option and strips it from remaining parents', () => {
        const options = freezeGraph([
            opt('X'),
            opt('Keep'),
            opt('Shared', ['X', 'Keep']),
        ]);
        const next = removeOption(options, 'X');
        expect(names(next)).toEqual(['Keep', 'Shared']);
        expect(next.find((o) => o.name === 'Shared')?.parents).toEqual(['Keep']);
        expect(options.find((o) => o.name === 'Shared')?.parents).toEqual(['X', 'Keep']);
    });

    test('last remaining parent after delete becomes a root with parents: []', () => {
        const next = removeOption([opt('A'), opt('B', ['A'])], 'A');
        expect(next.find((o) => o.name === 'B')?.parents).toEqual([]);
        expect(names(getRoots(next))).toEqual(['B']);
    });

    test('does not mutate the input array', () => {
        const options = freezeGraph([opt('A'), opt('B', ['A'])]);
        removeOption(options, 'A');
        expect(names(options)).toEqual(['A', 'B']);
    });
});

describe('cap checks', () => {
    test('wouldExceedMaxOptions is false on a tiny graph', () => {
        expect(wouldExceedMaxOptions([opt('A')])).toBe(false);
        expect(wouldExceedMaxOptions({length: GRAPH_MAX_OPTIONS} as PropertyFieldOption[])).toBe(true);
        expect(GRAPH_MAX_OPTIONS).toBe(100_000);
    });

    test('wouldExceedMaxEdges is false on a tiny graph', () => {
        expect(wouldExceedMaxEdges([opt('A'), opt('B', ['A'])])).toBe(false);
        expect(GRAPH_MAX_EDGES).toBe(1_000_000);
    });
});

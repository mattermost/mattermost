// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import type {GraphOccurrence} from '.';
import {
    alsoUnderLabel,
    emitIdToName,
    expandToSelected,
    flattenSearch,
    hydrateNameToId,
    joinGraphOptions,
    selectedDescendantCount,
} from '.';

// A graph option as GET /options reports one: parents by name, [] for a root.
const opt = (id: string, name: string, parents: string[] = []): PropertyFieldOption => ({id, name, parents});

// A shared_only option: the parents key comes off entirely.
const flat = (id: string, name: string): PropertyFieldOption => ({id, name});

const occKeys = (nodes: Array<{occKey: string}>) => nodes.map((n) => n.occKey);
const labels = (nodes: Array<{label: string}>) => nodes.map((n) => n.label);

// A → B, A → C, B → D, C → D. D is the diamond floor.
const diamond = (): PropertyFieldOption[] => [
    opt('a', 'A'),
    opt('b', 'B', ['A']),
    opt('c', 'C', ['A']),
    opt('d', 'D', ['B', 'C']),
];

// A → B, one parent.
const chainAB = (): PropertyFieldOption[] => [
    opt('a', 'A'),
    opt('b', 'B', ['A']),
];

// A → B → C, one parent each.
const chainABC = (): PropertyFieldOption[] => [
    opt('a', 'A'),
    opt('b', 'B', ['A']),
    opt('c', 'C', ['B']),
];

// R1 → S, R2 → S, S → T. S has two occurrences, so T has two occurrences that
// share the occKey 's::t': occKey is not a node identity.
const sharedParent = (): PropertyFieldOption[] => [
    opt('r1', 'R1'),
    opt('r2', 'R2'),
    opt('s', 'S', ['R1', 'R2']),
    opt('t', 'T', ['S']),
];

// The diamond with one child hung under its floor, so the two occurrences of D
// each carry an occurrence of E under the shared occKey 'd::e'.
const diamondWithChild = (): PropertyFieldOption[] => [
    ...diamond(),
    opt('e', 'E', ['D']),
];

// Every option in a layer sits below both options of the layer above: 2 * layers
// options, inside every server limit, 2^(layers-1) root-to-leaf paths.
const ladder = (layers: number): PropertyFieldOption[] => {
    const options: PropertyFieldOption[] = [opt('l0a', 'L0a'), opt('l0b', 'L0b')];
    for (let i = 1; i < layers; i++) {
        const above = [`L${i - 1}a`, `L${i - 1}b`];
        options.push(opt(`l${i}a`, `L${i}a`, above), opt(`l${i}b`, `L${i}b`, above));
    }
    return options;
};

// C0 → C1 → … → C(links-1), one option per level.
const deepChain = (links: number): PropertyFieldOption[] => {
    const options: PropertyFieldOption[] = [opt('c0', 'C0')];
    for (let i = 1; i < links; i++) {
        options.push(opt(`c${i}`, `C${i}`, [`C${i - 1}`]));
    }
    return options;
};

const allOccKeys = (nodes: GraphOccurrence[]): string[] => {
    const keys: string[] = [];
    for (const node of nodes) {
        keys.push(node.occKey, ...allOccKeys(node.children));
    }
    return keys;
};

const allLabels = (nodes: GraphOccurrence[]): string[] => {
    const found: string[] = [];
    for (const node of nodes) {
        found.push(node.label, ...allLabels(node.children));
    }
    return found;
};

const countOccurrences = (nodes: GraphOccurrence[]): number => {
    let total = 0;
    for (const node of nodes) {
        total += 1 + countOccurrences(node.children);
    }
    return total;
};

const allNodes = (nodes: GraphOccurrence[]): GraphOccurrence[] => {
    const found: GraphOccurrence[] = [];
    for (const node of nodes) {
        found.push(node, ...allNodes(node.children));
    }
    return found;
};

// Distinct value ids reachable in the occurrence tree, which is what truncation
// actually costs.
const allValueIds = (nodes: GraphOccurrence[], acc = new Set<string>()): Set<string> => {
    for (const node of nodes) {
        acc.add(node.valueId);
        allValueIds(node.children, acc);
    }
    return acc;
};

// Matches graph_utils.test.ts:51. Nothing in this module may write to a
// caller-owned array, and under strict mode a frozen target throws rather than
// failing silently.
const freezeGraph = (options: PropertyFieldOption[]): PropertyFieldOption[] => {
    return Object.freeze(options.map((option) => Object.freeze({
        ...option,
        parents: option.parents ? Object.freeze([...option.parents]) : option.parents,
    }))) as PropertyFieldOption[];
};

const findOccOrNothing = (nodes: GraphOccurrence[], occKey: string): GraphOccurrence | undefined => {
    for (const node of nodes) {
        if (node.occKey === occKey) {
            return node;
        }
        const found = findOccOrNothing(node.children, occKey);
        if (found) {
            return found;
        }
    }
    return undefined;
};

// Depth-first, first match, and a loud failure naming what the tree does hold.
const findOcc = (nodes: GraphOccurrence[], occKey: string): GraphOccurrence => {
    const found = findOccOrNothing(nodes, occKey);
    if (!found) {
        throw new Error(`no occurrence '${occKey}' in the tree: [${allOccKeys(nodes).join(', ')}]`);
    }
    return found;
};

// Two roots whose children arrays hold the very same child object. The join
// never produces this -- it seats a fresh occurrence per node -- but a caller
// that memoises occurrences by occKey or by value id would, and then the second
// parent must still learn it holds a selected value.
const sharedChildObject = (): GraphOccurrence[] => {
    const shared: GraphOccurrence = {occKey: 'p1::shared', valueId: 'shared', parentId: 'p1', label: 'Shared', alsoUnder: ['P2'], children: []};
    const p1: GraphOccurrence = {occKey: '::p1', valueId: 'p1', parentId: null, label: 'P1', alsoUnder: [], children: [shared]};
    const p2: GraphOccurrence = {occKey: '::p2', valueId: 'p2', parentId: null, label: 'P2', alsoUnder: [], children: [shared]};
    return [p1, p2];
};

// Two occurrences whose children point at each other. joinGraphOptions cannot
// produce this, but expandToSelected and selectedDescendantCount take a tree
// from any caller, so both have to survive it.
const cyclicOccurrences = (): GraphOccurrence[] => {
    const x: GraphOccurrence = {occKey: '::x', valueId: 'x', parentId: null, label: 'X', alsoUnder: [], children: []};
    const y: GraphOccurrence = {occKey: 'x::y', valueId: 'y', parentId: 'x', label: 'Y', alsoUnder: [], children: []};
    x.children.push(y);
    y.children.push(x);
    return [x, y];
};

describe('joinGraphOptions — name join', () => {
    test('joins parents to options by exact name', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(occKeys(roots)).toEqual(['::a']);
        expect(occKeys(roots[0].children)).toEqual(['a::b', 'a::c']);
        expect(occKeys(findOcc(roots, 'a::b').children)).toEqual(['b::d']);
    });

    test('Engineering and engineering are different options', () => {
        const {roots, byExactName} = joinGraphOptions([
            opt('e1', 'Engineering'),
            opt('e2', 'engineering'),
            opt('c', 'Child', ['Engineering']),
        ]);

        expect(occKeys(roots)).toEqual(['::e1', '::e2']);
        expect(occKeys(roots[0].children)).toEqual(['e1::c']);
        expect(roots[1].children).toEqual([]);
        expect(byExactName.get('engineering')!.id).toBe('e2');
    });

    test('a dangling parent name omits the edge and leaves a root', () => {
        const {roots} = joinGraphOptions([opt('a', 'A'), opt('b', 'B', ['Nope'])]);

        expect(occKeys(roots)).toEqual(['::a', '::b']);
        expect(roots[0].children).toEqual([]);
    });

    test('an option keeps the parents that do resolve when one dangles', () => {
        const {roots} = joinGraphOptions([opt('a', 'A'), opt('b', 'B', ['A', 'Nope'])]);

        expect(occKeys(roots)).toEqual(['::a']);
        expect(occKeys(roots[0].children)).toEqual(['a::b']);
        expect(findOcc(roots, 'a::b').alsoUnder).toEqual([]);
    });

    test('a missing parents key is a root, so shared_only reads flat', () => {
        const {roots} = joinGraphOptions([flat('a', 'A'), flat('b', 'B'), flat('c', 'C')]);

        expect(occKeys(roots)).toEqual(['::a', '::b', '::c']);
        expect(labels(roots)).toEqual(['A', 'B', 'C']);
        for (const root of roots) {
            expect(root.children).toEqual([]);
            expect(root.alsoUnder).toEqual([]);
        }
    });

    test('an empty parents array is a root', () => {
        const {roots} = joinGraphOptions([opt('a', 'A')]);

        expect(roots).toHaveLength(1);
        expect(roots[0].parentId).toBeNull();
        expect(roots[0].occKey).toBe('::a');
    });

    test('an empty options array has no roots', () => {
        const {roots, byId, byExactName} = joinGraphOptions([]);

        expect(roots).toEqual([]);
        expect(byId.size).toBe(0);
        expect(byExactName.size).toBe(0);
    });

    test('a single option is one root occurrence', () => {
        const {roots} = joinGraphOptions([opt('only', 'Only')]);

        expect(roots).toHaveLength(1);
        expect(roots[0]).toEqual({
            occKey: '::only',
            valueId: 'only',
            parentId: null,
            label: 'Only',
            alsoUnder: [],
            children: [],
        });
    });

    test('a duplicate name resolves to the first option', () => {
        const {roots, byExactName} = joinGraphOptions([
            opt('d1', 'Dup'),
            opt('d2', 'Dup'),
            opt('c', 'Child', ['Dup']),
        ]);

        expect(byExactName.get('Dup')!.id).toBe('d1');
        expect(occKeys(roots)).toEqual(['::d1', '::d2']);
        expect(occKeys(roots[0].children)).toEqual(['d1::c']);
        expect(roots[1].children).toEqual([]);
    });

    test('a duplicate id keeps the first option and adds no edges', () => {
        const {roots, byId} = joinGraphOptions([
            opt('x', 'First'),
            opt('x', 'Second'),
            opt('c', 'Child', ['Second']),
        ]);

        expect(byId.get('x')!.name).toBe('First');
        expect(byId.size).toBe(2);
        expect(allLabels(roots)).not.toContain('Second');
    });

    test('a parent named twice produces one edge', () => {
        const {roots} = joinGraphOptions([opt('a', 'A'), {id: 'b', name: 'B', parents: ['A', 'A']}]);

        expect(occKeys(roots)).toEqual(['::a']);
        expect(occKeys(roots[0].children)).toEqual(['a::b']);
        expect(findOcc(roots, 'a::b').alsoUnder).toEqual([]);
    });

    test('a parent that appears after its child still joins', () => {
        const {roots} = joinGraphOptions([opt('b', 'B', ['A']), opt('a', 'A')]);

        expect(occKeys(roots)).toEqual(['::a']);
        expect(occKeys(roots[0].children)).toEqual(['a::b']);
    });

    test('sibling order is the input order, not name or rank order', () => {
        const {roots} = joinGraphOptions([
            opt('a', 'A'),
            {...opt('z', 'Zulu', ['A']), rank: 2},
            {...opt('m', 'Mike', ['A']), rank: 1},
        ]);

        expect(labels(roots[0].children)).toEqual(['Zulu', 'Mike']);
    });

    test('root order is the input order', () => {
        const {roots} = joinGraphOptions([opt('z', 'Zulu'), opt('a', 'Alpha')]);

        expect(labels(roots)).toEqual(['Zulu', 'Alpha']);
    });

    test('byId and byExactName index every option', () => {
        const {byId, byExactName} = joinGraphOptions(diamond());

        expect(byId.size).toBe(4);
        expect(byExactName.size).toBe(4);
        expect(byId.get('d')!.name).toBe('D');
        expect(byExactName.get('D')!.id).toBe('d');
    });

    test('does not mutate a deep-frozen option list', () => {
        const options = freezeGraph(diamond());

        expect(() => joinGraphOptions(options)).not.toThrow();
        expect(options[3].parents).toEqual(['B', 'C']);
    });

    test('ignores read_only entirely', () => {
        // G8: read_only means "cannot author this option here", not "cannot
        // select it". Almost every policy graph field is linked, so its options
        // are all read_only — treating the flag as unselectable would empty the
        // tree rather than degrade it.
        const {roots} = joinGraphOptions([
            {id: 'p', name: 'P', parents: [], read_only: true},
            {id: 'c', name: 'C', parents: ['P'], read_only: true},
        ]);

        expect(occKeys(roots)).toEqual(['::p']);
        expect(occKeys(roots[0].children)).toEqual(['p::c']);
    });
});

describe('joinGraphOptions — multi-parent occurrences', () => {
    test('a diamond floor is two occurrences sharing one value id', () => {
        const {roots} = joinGraphOptions(diamond());

        const underB = findOcc(roots, 'b::d');
        const underC = findOcc(roots, 'c::d');

        expect(underB.valueId).toBe('d');
        expect(underC.valueId).toBe('d');
        expect(underB.parentId).toBe('b');
        expect(underC.parentId).toBe('c');
    });

    test('alsoUnder names the other parents on each occurrence', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(findOcc(roots, 'b::d').alsoUnder).toEqual(['C']);
        expect(findOcc(roots, 'c::d').alsoUnder).toEqual(['B']);
    });

    test('alsoUnder on a three-parent value lists the other two', () => {
        const {roots} = joinGraphOptions([
            opt('p1', 'P1'),
            opt('p2', 'P2'),
            opt('p3', 'P3'),
            opt('v', 'V', ['P1', 'P2', 'P3']),
        ]);

        expect(findOcc(roots, 'p1::v').alsoUnder).toEqual(['P2', 'P3']);
        expect(findOcc(roots, 'p2::v').alsoUnder).toEqual(['P1', 'P3']);
        expect(findOcc(roots, 'p3::v').alsoUnder).toEqual(['P1', 'P2']);
    });

    test('alsoUnder keeps the order the server reported the parents in', () => {
        const {roots} = joinGraphOptions([
            opt('p1', 'Zulu'),
            opt('p2', 'Alpha'),
            opt('v', 'V', ['Zulu', 'Alpha']),
        ]);

        expect(findOcc(roots, 'p2::v').alsoUnder).toEqual(['Zulu']);
    });

    test('a root occurrence has no alsoUnder', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(roots[0].alsoUnder).toEqual([]);
    });

    test('occKey uses an empty parent segment for a root', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(roots[0].occKey).toBe('::a');
    });

    test('allocates a distinct occurrence object for every node', () => {
        // expandToSelected guards on occurrence object identity, so the join
        // must never seat one object at two positions. The risky case is a
        // value reached through two parents: its occurrences share an occKey,
        // and reusing one object for both would make that guard prune the
        // second and leave an ancestor path collapsed.
        const {roots} = joinGraphOptions(diamondWithChild());

        const nodes = allNodes(roots);

        expect(new Set(nodes).size).toBe(nodes.length);

        const sharedKey = nodes.filter((node) => node.occKey === 'd::e');

        expect(sharedKey).toHaveLength(2);
        expect(sharedKey[0]).not.toBe(sharedKey[1]);
    });
});

describe('joinGraphOptions — cycle safety', () => {
    // The next two graphs are a pure cycle with nothing above it, so every
    // option resolves a parent, rootIds is empty and expansion never runs. They
    // characterise the absent component rather than the ancestor guard.
    test('a two-option cycle has no root and so is absent from the tree', () => {
        const {roots} = joinGraphOptions([opt('a', 'A', ['B']), opt('b', 'B', ['A'])]);

        expect(roots).toEqual([]);
    });

    test('a three-option cycle has no root and so is absent from the tree', () => {
        const {roots} = joinGraphOptions([
            opt('a', 'A', ['C']),
            opt('b', 'B', ['A']),
            opt('c', 'C', ['B']),
        ]);

        expect(roots).toEqual([]);
    });

    test('a cycle hanging off a root is cut on the path', () => {
        const {roots} = joinGraphOptions([
            opt('r', 'R'),
            opt('a', 'A', ['R', 'C']),
            opt('b', 'B', ['A']),
            opt('c', 'C', ['B']),
        ]);

        expect(occKeys(roots)).toEqual(['::r']);
        expect(occKeys(roots[0].children)).toEqual(['r::a']);
        expect(occKeys(findOcc(roots, 'r::a').children)).toEqual(['a::b']);
        expect(occKeys(findOcc(roots, 'a::b').children)).toEqual(['b::c']);
        expect(findOcc(roots, 'b::c').children).toEqual([]);
    });

    test('a self-parent is dropped and the option becomes a root', () => {
        const {roots} = joinGraphOptions([opt('a', 'A', ['A'])]);

        expect(occKeys(roots)).toEqual(['::a']);
        expect(roots[0].children).toEqual([]);
        expect(roots[0].alsoUnder).toEqual([]);
    });

    test('a self-parent alongside a real parent keeps the real one', () => {
        const {roots} = joinGraphOptions([opt('p', 'P'), opt('a', 'A', ['P', 'A'])]);

        expect(occKeys(roots)).toEqual(['::p']);
        expect(occKeys(roots[0].children)).toEqual(['p::a']);
        expect(findOcc(roots, 'p::a').alsoUnder).toEqual([]);
    });

    test('a diamond is not collapsed by the cycle guard', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(findOcc(roots, 'b::d').valueId).toBe('d');
        expect(findOcc(roots, 'c::d').valueId).toBe('d');
    });

    test('a cycle below a diamond is cut without collapsing either side', () => {
        // R → B, R → C, B → D, C → D, D → E, E → F, and F back to D. The guard
        // has to cut the back edge on each path while still emitting both
        // occurrences of D, so guard shape and cycle safety are pinned together
        // rather than one at a time.
        const {roots} = joinGraphOptions([
            opt('r', 'R'),
            opt('b', 'B', ['R']),
            opt('c', 'C', ['R']),
            opt('d', 'D', ['B', 'C', 'F']),
            opt('e', 'E', ['D']),
            opt('f', 'F', ['E']),
        ]);

        expect(occKeys(roots)).toEqual(['::r']);

        // Both diamond sides survive, each carrying the full chain below it, and
        // the back edge F → D is cut on the path rather than re-descending.
        for (const parentId of ['b', 'c']) {
            const floor = findOcc(roots, `${parentId}::d`);
            expect(floor.valueId).toBe('d');
            expect(occKeys(floor.children)).toEqual(['d::e']);

            const under = floor.children[0];
            expect(occKeys(under.children)).toEqual(['e::f']);
            expect(under.children[0].children).toEqual([]);
        }

        expect(allValueIds(roots).size).toBe(6);
    });
});

describe('joinGraphOptions — occurrence budget', () => {
    test('a diamond-heavy ladder terminates within the budget', () => {
        const options = ladder(100);

        expect(options).toHaveLength(200);

        const {roots} = joinGraphOptions(options);
        const emitted = countOccurrences(roots);

        // MIN_OCCURRENCE_BUDGET is 5000 and this graph has two roots, so the
        // budget is spent inside the first root and the second is seated as a
        // childless stub: one occurrence of overshoot per root beyond the first.
        expect(emitted).toBe(5001);

        // Truncation costs subtrees, never top-level rows.
        expect(labels(roots)).toEqual(['L0a', 'L0b']);
        expect(roots[1].children).toEqual([]);

        // And it really did truncate: most of the field is unreachable in the
        // tree, which is what makes the flat search path load-bearing.
        expect(allValueIds(roots).size).toBe(113);
        expect(allValueIds(roots).size).toBeLessThan(options.length);
    });

    test('seats every root even when the budget is spent', () => {
        // ladder(12) exhausts the budget exactly, so an unrelated root appended
        // after it is the case where a cost bound must not become a
        // completeness bound: whether a top-level option renders has to be
        // independent of unrelated options earlier in the array.
        const options = [...ladder(12), opt('zz', 'ZZ')];

        const {roots} = joinGraphOptions(options);

        expect(labels(roots)).toEqual(['L0a', 'L0b', 'ZZ']);
        expect(findOcc(roots, '::zz').valueId).toBe('zz');
    });

    test('a flat option list is never truncated', () => {
        const options: PropertyFieldOption[] = [];
        for (let i = 0; i < 2000; i++) {
            options.push(flat(`f${i}`, `F${i}`));
        }

        const {roots} = joinGraphOptions(options);

        expect(roots).toHaveLength(2000);
    });

    test('a deep chain is not truncated below the server depth limit', () => {
        const {roots} = joinGraphOptions(deepChain(100));

        expect(roots).toHaveLength(1);

        let node = roots[0];
        let depth = 1;
        while (node.children.length > 0) {
            node = node.children[0];
            depth++;
        }

        expect(depth).toBe(100);
        expect(node.label).toBe('C99');
        expect(node.children).toEqual([]);
    });

    test('every value in a truncated ladder is still findable by search', () => {
        const rows = flattenSearch(ladder(100), 'L99b');

        expect(rows).toHaveLength(1);
        expect(rows[0].valueId).toBe('l99b');
    });
});

describe('hydrateNameToId', () => {
    const {byExactName} = joinGraphOptions(diamond());

    test('resolves an exact name to its id', () => {
        expect(hydrateNameToId('D', byExactName)).toBe('d');
    });

    test('is case-sensitive', () => {
        expect(hydrateNameToId('d', byExactName)).toBeUndefined();
    });

    test('misses an unknown name', () => {
        expect(hydrateNameToId('Nope', byExactName)).toBeUndefined();
    });

    test('resolves a duplicate name to the first option', () => {
        const join = joinGraphOptions([opt('d1', 'Dup'), opt('d2', 'Dup')]);

        expect(hydrateNameToId('Dup', join.byExactName)).toBe('d1');
    });

    test('treats an empty option id as a miss', () => {
        const join = joinGraphOptions([opt('', 'Legacy')]);

        expect(hydrateNameToId('Legacy', join.byExactName)).toBeUndefined();
    });

    test('misses on an empty map', () => {
        expect(hydrateNameToId('A', new Map())).toBeUndefined();
    });
});

describe('emitIdToName', () => {
    const {byId} = joinGraphOptions(diamond());

    test('resolves an id to its name', () => {
        expect(emitIdToName('d', byId)).toBe('D');
    });

    test('falls back to the supplied label for an unknown id', () => {
        expect(emitIdToName('gone', byId, 'Last Known')).toBe('Last Known');
    });

    test('falls back to the id when no label is supplied', () => {
        expect(emitIdToName('gone', byId)).toBe('gone');
    });

    test('falls back to the id when the label is empty', () => {
        expect(emitIdToName('gone', byId, '')).toBe('gone');
    });

    test('prefers the option name over the fallback', () => {
        expect(emitIdToName('d', byId, 'Stale')).toBe('D');
    });
});

describe('flattenSearch', () => {
    test('matches an exact label', () => {
        const rows = flattenSearch(diamond(), 'D');

        expect(rows).toEqual([{valueId: 'd', label: 'D', path: 'A › B · +1'}]);
    });

    test('matches a partial label', () => {
        const rows = flattenSearch([opt('z', 'Zulu'), opt('a', 'Alpha')], 'ul');

        expect(rows).toHaveLength(1);
        expect(rows[0].valueId).toBe('z');
    });

    test('matches case-insensitively', () => {
        const rows = flattenSearch(diamond(), 'd');

        expect(rows).toHaveLength(1);
        expect(rows[0].valueId).toBe('d');
    });

    test('matches case-insensitively in the other direction', () => {
        const rows = flattenSearch([opt('e', 'ENGINEERING')], 'engineering');

        expect(rows).toHaveLength(1);
        expect(rows[0].valueId).toBe('e');
    });

    test('returns nothing for a query that matches nothing', () => {
        expect(flattenSearch(diamond(), 'zzz')).toEqual([]);
    });

    test('returns nothing for an empty query', () => {
        expect(flattenSearch(diamond(), '')).toEqual([]);
    });

    test('returns nothing for a whitespace-only query', () => {
        expect(flattenSearch(diamond(), '   ')).toEqual([]);
    });

    test('trims the query before matching', () => {
        const rows = flattenSearch(diamond(), '  D  ');

        expect(rows).toHaveLength(1);
        expect(rows[0].valueId).toBe('d');
    });

    test('returns nothing for an empty option list', () => {
        expect(flattenSearch([], 'a')).toEqual([]);
    });

    test('renders the first parent path with a plus count for a diamond', () => {
        const rows = flattenSearch(diamond(), 'D');

        expect(rows[0].path).toBe('A › B · +1');
    });

    test('renders a three-level path', () => {
        const rows = flattenSearch([
            opt('a', 'A'),
            opt('b', 'B', ['A']),
            opt('c', 'C', ['B']),
            opt('v', 'V', ['C']),
        ], 'V');

        expect(rows).toHaveLength(1);
        expect(rows[0].path).toBe('A › B › C');
    });

    test('renders A › B › C · +1 for a value with a second path', () => {
        const rows = flattenSearch([
            opt('a', 'A'),
            opt('b', 'B', ['A']),
            opt('c', 'C', ['B']),
            opt('x', 'X'),
            opt('v', 'V', ['C', 'X']),
        ], 'V');

        expect(rows).toHaveLength(1);
        expect(rows[0].path).toBe('A › B › C · +1');
    });

    test('renders an empty path for a root', () => {
        const rows = flattenSearch(diamond(), 'A');

        expect(rows).toHaveLength(1);
        expect(rows[0].path).toBe('');
    });

    test('renders an empty path for a value whose only parent dangles', () => {
        const rows = flattenSearch([opt('v', 'V', ['Nope'])], 'V');

        expect(rows).toHaveLength(1);
        expect(rows[0].path).toBe('');
    });

    test('emits one row per value id, not per occurrence', () => {
        expect(flattenSearch(diamond(), 'D')).toHaveLength(1);
    });

    test('emits one row per value even when two values share a name', () => {
        const rows = flattenSearch([opt('d1', 'Dup'), opt('d2', 'Dup')], 'dup');

        expect(rows.map((row) => row.valueId)).toEqual(['d1', 'd2']);
    });

    test('orders rows by the input order', () => {
        const rows = flattenSearch([opt('z', 'Zulua'), opt('a', 'Alpha')], 'a');

        expect(rows.map((row) => row.valueId)).toEqual(['z', 'a']);
    });

    test('saturates the plus count rather than multiplying out a diamond ladder', () => {
        const rows = flattenSearch(ladder(100), 'L99b');

        expect(rows).toHaveLength(1);
        expect(rows[0].path.endsWith('· +99')).toBe(true);
    });

    test('is cycle-safe on the path walk', () => {
        const rows = flattenSearch([opt('a', 'A', ['B']), opt('b', 'B', ['A'])], 'A');

        expect(rows).toHaveLength(1);
        expect(rows[0].valueId).toBe('a');

        // The walk stops at the back edge, so the path is the one parent above
        // A and the saturating count floors at a single path.
        expect(rows[0].path).toBe('B');
    });

    test('ignores read_only entirely', () => {
        const rows = flattenSearch([{id: 'a', name: 'A', parents: [], read_only: true}], 'A');

        expect(rows).toEqual([{valueId: 'a', label: 'A', path: ''}]);
    });

    test('does not mutate a deep-frozen option list', () => {
        const options = freezeGraph(diamond());

        expect(() => flattenSearch(options, 'D')).not.toThrow();
        expect(options[3].parents).toEqual(['B', 'C']);
    });
});

describe('expandToSelected', () => {
    test('opens only the ancestors of a selected value', () => {
        const {roots} = joinGraphOptions(chainABC());

        expect(expandToSelected(roots, new Set(['c']))).toEqual(new Set(['::a', 'a::b']));
    });

    test('does not open a selected leaf', () => {
        const {roots} = joinGraphOptions(chainAB());

        expect(expandToSelected(roots, new Set(['b']))).toEqual(new Set(['::a']));
    });

    test('opens a selected node that itself holds a selected descendant', () => {
        const {roots} = joinGraphOptions(chainABC());

        const open = expandToSelected(roots, new Set(['b', 'c']));

        expect(open).toEqual(new Set(['::a', 'a::b']));

        // 'a::b' is open because C is beneath it, not because B is checked: B
        // being selected adds nothing of its own, which is what separates this
        // from the {'c'} case above.
        expect(open.has('b::c')).toBe(false);
        expect(expandToSelected(roots, new Set(['c']))).toEqual(open);
    });

    test('leaves unrelated branches collapsed', () => {
        const {roots} = joinGraphOptions([
            opt('a', 'A'),
            opt('b', 'B', ['A']),
            opt('c', 'C', ['A']),
            opt('e', 'E', ['C']),
        ]);

        expect(expandToSelected(roots, new Set(['b']))).toEqual(new Set(['::a']));
    });

    test('opens both occurrence paths to a value with two parents', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(expandToSelected(roots, new Set(['d']))).toEqual(new Set(['::a', 'a::b', 'a::c']));
    });

    test('returns an empty set when nothing is selected', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(expandToSelected(roots, new Set()).size).toBe(0);
    });

    test('returns an empty set for a stale selected id that is not in the tree', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(expandToSelected(roots, new Set(['ghost'])).size).toBe(0);
    });

    test('ignores a stale id while still opening for a real one', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(expandToSelected(roots, new Set(['ghost', 'd']))).toEqual(new Set(['::a', 'a::b', 'a::c']));
    });

    test('opens every ancestor path when a value\'s parent has two occurrences', () => {
        const {roots} = joinGraphOptions(sharedParent());

        // T's two occurrences share the occKey 's::t', so a guard keyed on
        // occKey prunes the second and leaves the whole R2 branch collapsed.
        expect(expandToSelected(roots, new Set(['t']))).toEqual(new Set(['::r1', 'r1::s', '::r2', 'r2::s']));
    });

    test('opens both sides of a diamond that has a child below the floor', () => {
        const {roots} = joinGraphOptions(diamondWithChild());

        expect(expandToSelected(roots, new Set(['e']))).toEqual(new Set(['::a', 'a::b', 'a::c', 'b::d', 'c::d']));
    });

    test('returns an empty set for an empty tree', () => {
        expect(expandToSelected([], new Set(['a'])).size).toBe(0);
    });

    test('does not hang on a hand-built cyclic occurrence tree', () => {
        const open = expandToSelected(cyclicOccurrences(), new Set(['x']));

        expect(open.size).toBe(0);
    });

    test('opens both parent paths when two parents share one child object', () => {
        // The guard cannot key on the node alone: it has to remember the
        // per-node answer, or the second parent to reach a shared object gets
        // told "already seen" and stays collapsed over a checked value.
        expect(expandToSelected(sharedChildObject(), new Set(['shared']))).toEqual(new Set(['::p1', '::p2']));
    });
});

describe('selectedDescendantCount', () => {
    const twoChildren = (): PropertyFieldOption[] => [
        opt('a', 'A'),
        opt('b', 'B', ['A']),
        opt('c', 'C', ['A']),
    ];

    test('counts selected descendants', () => {
        const {roots} = joinGraphOptions(twoChildren());

        expect(selectedDescendantCount(findOcc(roots, '::a'), new Set(['b', 'c']))).toBe(2);
    });

    test('excludes the node itself', () => {
        const {roots} = joinGraphOptions(chainAB());

        expect(selectedDescendantCount(findOcc(roots, '::a'), new Set(['a', 'b']))).toBe(1);
    });

    test('counts a value reachable by two paths under the same ancestor once', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(selectedDescendantCount(findOcc(roots, '::a'), new Set(['d']))).toBe(1);
    });

    test('counts across depth', () => {
        const {roots} = joinGraphOptions(chainABC());

        expect(selectedDescendantCount(findOcc(roots, '::a'), new Set(['b', 'c']))).toBe(2);
    });

    test('counts nothing when the subtree holds no selected value', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(selectedDescendantCount(findOcc(roots, '::a'), new Set(['ghost']))).toBe(0);
    });

    test('returns zero for an empty selection', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(selectedDescendantCount(findOcc(roots, '::a'), new Set())).toBe(0);
    });

    test('returns zero for a leaf occurrence', () => {
        const {roots} = joinGraphOptions(diamond());

        expect(selectedDescendantCount(findOcc(roots, 'b::d'), new Set(['d']))).toBe(0);
    });

    test('counts only within the given subtree', () => {
        const {roots} = joinGraphOptions(twoChildren());

        expect(selectedDescendantCount(findOcc(roots, 'a::b'), new Set(['c']))).toBe(0);
    });

    test('does not hang on a hand-built cyclic occurrence tree', () => {
        expect(selectedDescendantCount(cyclicOccurrences()[0], new Set(['x']))).toBe(0);
    });
});

describe('alsoUnderLabel', () => {
    test('is empty for no other parents', () => {
        expect(alsoUnderLabel([])).toBe('');
    });

    test('is the bare name for one other parent', () => {
        expect(alsoUnderLabel(['A'])).toBe('A');
    });

    test('joins two with and', () => {
        expect(alsoUnderLabel(['A', 'B'])).toBe('A and B');
    });

    test('Oxford-joins three', () => {
        expect(alsoUnderLabel(['A', 'B', 'C'])).toBe('A, B, and C');
    });

    test('Oxford-joins four', () => {
        expect(alsoUnderLabel(['A', 'B', 'C', 'D'])).toBe('A, B, C, and D');
    });

    test('matches the occurrence alsoUnder of a three-parent value', () => {
        const {roots} = joinGraphOptions([
            opt('p1', 'P1'),
            opt('p2', 'P2'),
            opt('p3', 'P3'),
            opt('v', 'V', ['P1', 'P2', 'P3']),
        ]);

        expect(alsoUnderLabel(findOcc(roots, 'p1::v').alsoUnder)).toBe('P2 and P3');
    });
});

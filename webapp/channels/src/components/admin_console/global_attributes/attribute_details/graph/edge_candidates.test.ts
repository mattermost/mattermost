// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {GRAPH_MAX_DEPTH, GRAPH_MAX_PARENTS_PER_VALUE} from 'components/property_fields/graph';

import {
    classifyParentCandidate,
    enabledSuggestionNames,
    type EdgeDirection,
} from './edge_candidates';

const opt = (name: string, parents: string[] = []): PropertyFieldOption => ({id: '', name, parents});

function naiveEnabled(
    options: PropertyFieldOption[],
    optionName: string,
    direction: EdgeDirection,
): string[] {
    const names: string[] = [];
    for (const candidate of options) {
        const classification = direction === 'children' ?
            classifyParentCandidate(options, candidate.name, optionName) :
            classifyParentCandidate(options, optionName, candidate.name);
        if (classification.kind === 'enabled') {
            names.push(candidate.name);
        }
    }
    return names;
}

describe('enabledSuggestionNames', () => {
    const graphs: Array<{name: string; options: PropertyFieldOption[]}> = [
        {
            name: 'chain A→B→C',
            options: [opt('A'), opt('B', ['A']), opt('C', ['B'])],
        },
        {
            name: 'siblings under a root',
            options: [opt('Root'), opt('Left', ['Root']), opt('Right', ['Root']), opt('Other')],
        },
        {
            name: 'diamond',
            options: [opt('Top'), opt('MidA', ['Top']), opt('MidB', ['Top']), opt('Leaf', ['MidA', 'MidB'])],
        },
    ];

    test.each(graphs)('matches per-candidate classifyParentCandidate for $name', ({options}) => {
        for (const option of options) {
            expect(enabledSuggestionNames(options, option.name, 'parents')).toEqual(
                naiveEnabled(options, option.name, 'parents'),
            );
            expect(enabledSuggestionNames(options, option.name, 'children')).toEqual(
                naiveEnabled(options, option.name, 'children'),
            );
        }
    });

    test('omits a parent that would exceed GRAPH_MAX_DEPTH', () => {
        const options = [
            ...Array.from({length: GRAPH_MAX_DEPTH}, (_, i) => (
                i === 0 ? opt(`L${i}`) : opt(`L${i}`, [`L${i - 1}`])
            )),
            opt('Side'),
        ];
        const leaf = `L${GRAPH_MAX_DEPTH - 1}`;

        expect(classifyParentCandidate(options, 'Side', leaf)).toEqual({kind: 'disabled', reason: 'depth'});
        expect(enabledSuggestionNames(options, 'Side', 'parents')).toEqual(
            naiveEnabled(options, 'Side', 'parents'),
        );
        expect(enabledSuggestionNames(options, 'Side', 'parents')).not.toContain(leaf);
    });

    test('omits a child already at GRAPH_MAX_PARENTS_PER_VALUE', () => {
        const parentNames = Array.from({length: GRAPH_MAX_PARENTS_PER_VALUE}, (_, i) => `P${i}`);
        const options = [
            opt('Child', parentNames),
            ...parentNames.map((name) => opt(name)),
            opt('New'),
        ];

        expect(classifyParentCandidate(options, 'Child', 'New')).toEqual({kind: 'disabled', reason: 'max-parents'});
        expect(enabledSuggestionNames(options, 'New', 'children')).toEqual(
            naiveEnabled(options, 'New', 'children'),
        );
        expect(enabledSuggestionNames(options, 'New', 'children')).not.toContain('Child');
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {ScopeGraph, ScopeGraphBudgetError, type ScopeState} from '../src/scope_graph.ts';

test('all states of a render cycle share its complete union, including a later outgoing branch', () => {
    const graph = new ScopeGraph();
    const nodes = [{}, {}, {}];
    const a = graph.state(nodes[0], '', 'A', (state) => {
        state.own.add('a');
        graph.link(state, b);
        graph.link(state, graph.state(nodes[2], '', 'C', (child) => child.own.add('c')));
    });
    const b = graph.state(nodes[1], '', 'B', (state) => {
        state.own.add('b');
        graph.link(state, a);
    });
    assert.deepEqual([...graph.values(a)].sort(), ['a', 'b', 'c']);
    assert.deepEqual([...graph.values(b)].sort(), ['a', 'b', 'c']);
    assert.equal(a.scopes, b.scopes, 'one result set is shared by the component');
    assert.equal(graph.stats().renderScopeEvaluated, 3);
    assert.equal(graph.stats().renderScopeComponents, 2);
    assert.equal(graph.stats().renderScopeLargestSet, 3);
});

test('one recursive component under different context states keeps its mounts separate', () => {
    const graph = new ScopeGraph();
    const node = {};
    const state = (name: string): ScopeState => graph.state(node, name, name, (self) => {
        self.own.add(name);
        graph.link(self, state(name));
    });
    const x = state('x');
    const y = state('y');
    assert.deepEqual([...graph.values(x)], ['x']);
    assert.deepEqual([...graph.values(y)], ['y']);
    assert.equal(graph.stats().renderScopeStates, 2);
    assert.equal(graph.stats().renderScopeEvaluated, 2);
});

test('a deep wrapper chain is evaluated once per state without recursive graph expansion or solving', () => {
    const graph = new ScopeGraph();
    const nodes = Array.from({length: 10000}, () => ({}));
    const at = (index: number): ScopeState => graph.state(nodes[index], '', String(index), (state) => {
        if (index + 1 === nodes.length) {
            state.own.add('leaf');
        } else {
            graph.link(state, at(index + 1));
        }
    });
    assert.deepEqual([...graph.values(at(0))], ['leaf']);
    assert.equal(graph.stats().renderScopeEvaluated, nodes.length);
    assert.equal(graph.stats().renderScopeStates, nodes.length);
});

test('render graph budgets identify the component instead of returning an incomplete result', () => {
    const graph = new ScopeGraph({states: 1, edges: 1});
    graph.state({}, '', 'Root', () => {});
    assert.throws(() => graph.state({}, '', 'OverflowComponent', () => {}), (error: unknown) => error instanceof ScopeGraphBudgetError && error.message.includes('OverflowComponent'));
});

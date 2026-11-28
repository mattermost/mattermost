// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ScopeState = {
    readonly label: string;
    readonly own: Set<string>;
    readonly next: Set<ScopeState>;
    scopes: Set<string> | null;
};

export class ScopeGraphBudgetError extends Error {}

/** Render-scope reachability over finite context states, with one scope set per strongly connected component. */
export class ScopeGraph {
    private readonly nodes = new WeakMap<object, Map<string, ScopeState>>();
    private readonly expanders = new Map<ScopeState, (state: ScopeState) => void>();
    private pending: ScopeState[] = [];
    private cursor = 0;
    private states = 0;
    private edges = 0;
    private evaluated = 0;
    private components = 0;
    private largest = 0;
    private readonly limits: {states: number; edges: number};

    constructor(limits = {states: 100000, edges: 1000000}) {
        this.limits = limits;
    }

    state(node: object, context: string, label: string, expand: (state: ScopeState) => void): ScopeState {
        const contexts = this.nodes.get(node) ?? new Map<string, ScopeState>();
        const existing = contexts.get(context);
        if (existing) {
            return existing;
        }
        if (this.states >= this.limits.states) {
            throw new ScopeGraphBudgetError(`Render-scope state budget ${this.limits.states} exceeded at ${label}.`);
        }
        const state: ScopeState = {label, own: new Set(), next: new Set(), scopes: null};
        contexts.set(context, state);
        this.nodes.set(node, contexts);
        this.states++;
        this.expanders.set(state, expand);
        this.pending.push(state);
        return state;
    }

    link(source: ScopeState, target: ScopeState): void {
        if (source.next.has(target)) {
            return;
        }
        if (source.scopes) {
            throw new Error(`Resolved render-scope state ${source.label} cannot gain a successor.`);
        }
        if (this.edges >= this.limits.edges) {
            throw new ScopeGraphBudgetError(`Render-scope edge budget ${this.limits.edges} exceeded at ${source.label}.`);
        }
        source.next.add(target);
        this.edges++;
    }

    values(root: ScopeState): Set<string> {
        // Expansion is iterative too: a long wrapper chain must not consume the JavaScript call stack.
        while (this.cursor < this.pending.length) {
            const state = this.pending[this.cursor++];
            const expand = this.expanders.get(state)!;
            this.expanders.delete(state);
            this.evaluated++;
            expand(state);
        }
        this.pending = [];
        this.cursor = 0;
        if (!root.scopes) {
            this.solve(root);
        }
        return root.scopes!;
    }

    private solve(root: ScopeState): void {
        type Entry = {index: number; low: number; active: boolean};
        type Frame = {state: ScopeState; successors: ScopeState[]; cursor: number};
        const entries = new Map<ScopeState, Entry>();
        const members: ScopeState[] = [];
        const frames: Frame[] = [];
        let index = 0;
        const discover = (state: ScopeState) => {
            entries.set(state, {index, low: index, active: true});
            index++;
            members.push(state);
            frames.push({state, successors: [...state.next], cursor: 0});
        };
        discover(root);

        // Iterative Tarjan: components finish in reverse topological order, so their outgoing results already exist.
        while (frames.length) {
            const frame = frames[frames.length - 1];
            const entry = entries.get(frame.state)!;
            if (frame.cursor < frame.successors.length) {
                const target = frame.successors[frame.cursor++];
                if (target.scopes) {
                    continue;
                }
                const seen = entries.get(target);
                if (!seen) {
                    discover(target);
                } else if (seen.active) {
                    entry.low = Math.min(entry.low, seen.index);
                }
                continue;
            }
            frames.pop();
            if (frames.length) {
                const parent = entries.get(frames[frames.length - 1].state)!;
                parent.low = Math.min(parent.low, entry.low);
            }
            if (entry.low !== entry.index) {
                continue;
            }
            const component: ScopeState[] = [];
            let member: ScopeState;
            do {
                member = members.pop()!;
                entries.get(member)!.active = false;
                component.push(member);
            } while (member !== frame.state);
            const scopes = new Set(component.flatMap((state) => [...state.own]));
            for (const state of component) {
                for (const target of state.next) {
                    for (const scope of target.scopes ?? []) {
                        scopes.add(scope);
                    }
                }
            }
            for (const state of component) {
                state.scopes = scopes;
            }
            this.components++;
            this.largest = Math.max(this.largest, scopes.size);
        }
    }

    stats(): Record<string, number> {
        return {renderScopeStates: this.states, renderScopeEdges: this.edges, renderScopeEvaluated: this.evaluated, renderScopeComponents: this.components, renderScopeLargestSet: this.largest};
    }
}

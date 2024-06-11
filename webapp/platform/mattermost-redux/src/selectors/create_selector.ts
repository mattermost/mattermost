// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CreateSelectorFunction, MemoizeFunction} from './create_selector_types';

/* eslint-disable */

// Generates a RFC-4122 version 4 compliant globally unique identifier.
export function generateId() {
    // implementation taken from http://stackoverflow.com/a/2117523
    let id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    id = id.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        let v;

        if (c === 'x') {
            v = r;
        } else {
            // eslint-disable-next-line no-mixed-operators
            v = r & 0x3 | 0x8;
        }

        return v.toString(16);
    });
    return id;
}

function defaultEqualityCheck<T>(a: T, b: T) {
    return a === b;
}

function areArgumentsShallowlyEqual(equalityCheck: typeof defaultEqualityCheck, prev: unknown[] | null, next: unknown[] | null) {
    if (prev === null || next === null || prev.length !== next.length) {
        return false;
    }

    // Do this in a for loop (and not a `forEach` or an `every`) so we can determine equality as fast as possible.
    const length = prev.length;
    for (let i = 0; i < length; i++) {
        if (!equalityCheck(prev[i], next[i])) {
            return false;
        }
    }

    return true;
}

export function defaultMemoize(func: Function, measure: Function | undefined | null, equalityCheck = defaultEqualityCheck) {
    let lastArgs: unknown[] | null = null
    let lastResult: unknown = null
    // we reference arguments instead of spreading them for performance reasons
    return function () {
        if (!areArgumentsShallowlyEqual(equalityCheck, lastArgs, arguments as unknown as unknown[])) {
            // apply arguments instead of spreading for performance.
            lastResult = func.apply(null, arguments)
        }

        if (measure) {
            measure();
        }
        lastArgs = arguments as unknown as unknown[]
        return lastResult
    }
}

function getDependencies(funcs: unknown[]) {
    const dependencies = Array.isArray(funcs[0]) ? funcs[0] : funcs;

    if (!dependencies.every((dep) => typeof dep === 'function')) {
        const dependencyTypes = dependencies.map(
            (dep) => typeof dep,
        ).join(', ');
        throw new Error(
            'Selector creators expect all input-selectors to be functions, ' +
        `instead received the following types: [${dependencyTypes}]`,
        );
    }

    return dependencies;
}

type TrackedSelector = {
    id: string;
    name: string;
    calls: number;
    recomputations: number;
}

const trackedSelectors: Record<string, TrackedSelector> = {};

export function createSelectorCreator(memoize: MemoizeFunction, ...memoizeOptions: any): CreateSelectorFunction {
    const creator = (name: string, ...funcs: any[]) => {
        const id = generateId();
        let recomputations = 0;
        let calls = 0;
        const resultFunc = funcs.pop();
        const dependencies = getDependencies(funcs);

        const memoizedResultFunc = memoize(
            function() {
                recomputations++;
                trackedSelectors[id].recomputations++;

                // apply arguments instead of spreading for performance.
                return resultFunc?.apply(null, arguments);
            },
            null,
            ...memoizeOptions,
        );

        // If a selector is called with the exact same arguments we don't need to traverse our dependencies again.
        const selector = memoize(function() {
            const params = [];
            const length = dependencies.length;

            for (let i = 0; i < length; i++) {
                // apply arguments instead of spreading and mutate a local list of params for performance.
                params.push(dependencies[i].apply(null, arguments));
            }

            // apply arguments instead of spreading for performance.
            return (memoizedResultFunc as any).apply(null, params);
        },
        () => {
            calls++;
            trackedSelectors[id].calls++;
        });

        (selector as any).resultFunc = resultFunc;
        (selector as any).dependencies = dependencies;
        (selector as any).recomputations = () => recomputations;
        (selector as any).resetRecomputations = () => recomputations = 0;

        trackedSelectors[id] = {
            id,
            name,
            calls: 0,
            recomputations: 0,
        };

        return selector;
    };
    return creator as unknown as CreateSelectorFunction;
}

export const createSelector = /* #__PURE__ */ createSelectorCreator(defaultMemoize as MemoizeFunction);

// export function createStructuredSelector(selectors: Record<string, unknown>, selectorCreator: CreateSelectorFunction = createSelector): ReturnType<CreateStructuredSelectorFunction> {
//     if (typeof selectors !== 'object') {
//         throw new Error(
//             'createStructuredSelector expects first argument to be an object ' +
//         `where each property is a selector, instead received a ${typeof selectors}`,
//         );
//     }
//     const objectKeys = Object.keys(selectors);
//     return selectorCreator(
//         objectKeys.map((key) => selectors[key]),
//         (...values: any[]) => {
//             return values.reduce((composition, value, index) => {
//                 composition[objectKeys[index]] = value;
//                 return composition;
//             }, {});
//         },
//     );
// }

// resetTrackedSelectors resets all the measurements for memoization effectiveness.
function resetTrackedSelectors() {
    Object.values(trackedSelectors).forEach((selector) => {
        selector.calls = 0;
        selector.recomputations = 0;
    });
}

// getSortedTrackedSelectors returns an array, sorted by effectivness, containing mesaurement data on all tracked selectors.
export function getSortedTrackedSelectors() {
    let selectors = Object.values(trackedSelectors);
    // Filter out any selector not called
    selectors = selectors.filter(selector => selector.calls > 0);
    const selectorsData = selectors.map((selector) => ({name: selector.name, effectiveness: effectiveness(selector), recomputations: selector.recomputations, calls: selector.calls}));
    selectorsData.sort((a, b) => {
        // Sort effectiveness ascending
        if (a.effectiveness !== b.effectiveness) {
            return a.effectiveness - b.effectiveness;
        }

        // And everything else descending
        if (a.recomputations !== b.recomputations) {
            return b.recomputations - a.recomputations;
        }

        if (a.calls !== b.calls) {
            return b.calls - a.calls;
        }

        return a.name.localeCompare(b.name);
    });
    return selectorsData;
}

function effectiveness(selector: TrackedSelector) {
    return 100 - ((selector.recomputations / selector.calls) * 100);
}

// dumpTrackedSelectorsStatistics prints to console a table containing the measurement data on all tracked selectors.
function dumpTrackedSelectorsStatistics() {
    const selectors = getSortedTrackedSelectors();
    console.table(selectors); //eslint-disable-line no-console
}

(window as any).dumpTrackedSelectorsStatistics = dumpTrackedSelectorsStatistics;
(window as any).resetTrackedSelectors = resetTrackedSelectors;
(window as any).getSortedTrackedSelectors = getSortedTrackedSelectors


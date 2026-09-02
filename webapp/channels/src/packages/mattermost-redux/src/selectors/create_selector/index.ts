// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable prefer-spread */
/* eslint-disable prefer-rest-params */

import type {CreateSelector, EqualityCheck, ParametricSelector, Selector} from './types';

export type {
    Selector,
    OutputSelector,
    ParametricSelector,
    OutputParametricSelector,
    CreateSelector,
} from './types';

function defaultEqualityCheck(a: any, b: any): boolean {
    return a === b;
}

function areArgumentsShallowlyEqual(equalityCheck: EqualityCheck, prev: IArguments | null, next: IArguments | null): boolean {
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

export function defaultMemoize<F extends Function>(func: F, equalityCheck: Function = defaultEqualityCheck): F {
    let lastArgs: IArguments | null = null;
    let lastResult: any = null;

    // we reference arguments instead of spreading them for performance reasons
    return function memoized() {
        if (!areArgumentsShallowlyEqual(equalityCheck as EqualityCheck, lastArgs, arguments)) {
            // apply arguments instead of spreading for performance.
            lastResult = func.apply(null, arguments as any);
        }

        lastArgs = arguments;
        return lastResult;
    } as unknown as F;
}

function getDependencies(funcs: any[]): Function[] {
    const dependencies = Array.isArray(funcs[0]) ? funcs[0] : funcs;

    if (!dependencies.every((dep: any) => typeof dep === 'function')) {
        const dependencyTypes = dependencies.map(
            (dep: any) => typeof dep,
        ).join(', ');
        throw new Error(
            'Selector creators expect all input-selectors to be functions, ' +
        `instead received the following types: [${dependencyTypes}]`,
        );
    }

    return dependencies;
}

export function createSelectorCreator(
    memoize: <F extends Function>(func: F, measure: Function) => F,
): typeof createSelector;

export function createSelectorCreator<O1>(
    memoize: <F extends Function>(func: F, measure: Function,
        option1: O1) => F,
    option1: O1,
): typeof createSelector;

export function createSelectorCreator<O1, O2>(
    memoize: <F extends Function>(func: F, measure: Function,
        option1: O1,
        option2: O2) => F,
    option1: O1,
    option2: O2,
): typeof createSelector;

export function createSelectorCreator<O1, O2, O3>(
    memoize: <F extends Function>(func: F, measure: Function,
        option1: O1,
        option2: O2,
        option3: O3,
        ...rest: any[]) => F,
    option1: O1,
    option2: O2,
    option3: O3,
    ...rest: any[]
): typeof createSelector;

export function createSelectorCreator(memoize: any, ...memoizeOptions: any[]): typeof createSelector {
    return ((_name: string, ...funcs: any[]) => {
        const resultFunc = funcs.pop();
        const dependencies = getDependencies(funcs);

        const memoizedResultFunc = memoize(
            function resultFuncMemoized() {
                // apply arguments instead of spreading for performance.
                return resultFunc?.apply(null, arguments);
            },
            ...memoizeOptions,
        );

        // If a selector is called with the exact same arguments we don't need to traverse our dependencies again.
        const selector = memoize(function selectorMemoized() {
            const params = [];
            const length = dependencies.length;

            for (let i = 0; i < length; i++) {
                // apply arguments instead of spreading and mutate a local list of params for performance.
                params.push(dependencies[i].apply(null, arguments));
            }

            // apply arguments instead of spreading for performance.
            return memoizedResultFunc.apply(null, params);
        });

        selector.resultFunc = resultFunc;
        selector.dependencies = dependencies;

        return selector;
    });
}

export const createSelector: CreateSelector = /* #__PURE__ */ createSelectorCreator(defaultMemoize);

export function createStructuredSelector<S, T>(
    selectors: {[K in keyof T]: Selector<S, T[K]>},
    selectorCreator?: typeof createSelector,
): Selector<S, T>;

export function createStructuredSelector<S, P, T>(
    selectors: {[K in keyof T]: ParametricSelector<S, P, T[K]>},
    selectorCreator?: typeof createSelector,
): ParametricSelector<S, P, T>;

export function createStructuredSelector(selectors: any, selectorCreator: any = createSelector): any {
    if (typeof selectors !== 'object') {
        throw new Error(
            'createStructuredSelector expects first argument to be an object ' +
        `where each property is a selector, instead received a ${typeof selectors}`,
        );
    }
    const objectKeys = Object.keys(selectors);
    return selectorCreator(
        objectKeys.map((key) => selectors[key]),
        (...values: any[]) => {
            return values.reduce((composition: any, value: any, index: number) => {
                composition[objectKeys[index]] = value;
                return composition;
            }, {});
        },
    );
}

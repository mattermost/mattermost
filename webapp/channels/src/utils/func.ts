// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {intersection, isPlainObject, zipObject} from 'lodash';

/**
 * Transform a function with multiple args into one that receives a normalized args object.
 * @param keyOrder the ordered keys/args for object-normalization and backwards-compatibility
 * @param func the normal method definition that receives the normalized args object
 * @returns func-invoker that supports ordered arguments or a single object argument
 * @remarks it's best to provide a type for {@link TArgs} which enables {@link keyOrder} type checking.
 * @example
 * const wrappedMethod = reArg(['a', 'b', 'c', 'd', 'e', 'f', 'g'], (props: TArgs) => {
 *     // do stuff
 *     const a = props.a;
 *     const {b, c, d, e, f, g: z} = props;
 * });
 * // invoke via:
 * wrappedMethod({a, b, c, d, e, f, g});
 * // or:
 * wrappedMethod(a, b, c, d, e, f, g);
 */
export function reArg<TArgs extends Record<string, unknown>, TResult>(keyOrder: Array<keyof TArgs>, func: (args: TArgs) => TResult) {
    // Ordered-argument typing (`| any[]` bellow) could possibly be improved to support type checking when not invoking with via TArgs
    return (...args: [TArgs] | any[]) => {
        const isConfigObjectArg = args.length === 1 && isPlainObject(args[0]);

        // validate against key-name clashes if arg is an object
        const objKeys = isConfigObjectArg && Object.keys(args[0]);
        const keysMatch = objKeys && intersection(objKeys, keyOrder).length === objKeys.length;

        return func(isConfigObjectArg && keysMatch ? args[0] : zipObject(keyOrder, args));
    };
}

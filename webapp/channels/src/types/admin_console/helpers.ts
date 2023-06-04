export type ConsoleAccess = {
    read: Record<string, boolean>;
    write: Record<string, boolean>;
};

/**
 * Flattens the properties of an object recursively.
 *
 * @template T - The input type to flatten.
 * @param {T} obj - The object to be flattened.
 * @returns {T extends object ? { [K in keyof T]: T[K] } : never} - The flattened object.
 *
 * @example
 * // Flattening an object
 * const obj = {
 *   prop1: {
 *     nestedProp1: 1,
 *     nestedProp2: 'two',
 *   },
 *   prop2: {
 *     nestedProp3: true,
 *     nestedProp4: ['a', 'b', 'c'],
 *   },
 * };
 *
 * type FlattenedObj = FlattenProperties<typeof obj>;
 * // FlattenedObj is equivalent to:
 * // {
 * //   prop1: {
 * //     nestedProp1: 1,
 * //     nestedProp2: 'two',
 * //   },
 * //   nestedProp1: 1,
 * //   nestedProp2: 'two',
 * //   prop2: {
 * //     nestedProp3: true,
 * //     nestedProp4: ['a', 'b', 'c'],
 * //   },
 * //   nestedProp3: true,
 * //   nestedProp4: ['a', 'b', 'c'],
 * // }
 */
export type FlattenProperties<T> = T extends object
    ? { [K in keyof T]: T[K] }
    : never;

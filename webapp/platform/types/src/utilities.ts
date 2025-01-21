// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type RelationOneToOne<E extends {id: string}, T> = {
    [x in E['id']]: T;
};
export type RelationOneToMany<E1 extends {id: string}, E2 extends {id: string}> = {
    [x in E1['id']]: Array<E2['id']>;
};
export type RelationOneToManyUnique<E1 extends {id: string}, E2 extends {id: string}> = {
    [x in E1['id']]: Set<E2['id']>;
};

export type IDMappedObjects<E extends {id: string}> = RelationOneToOne<E, E>;

export type IDMappedCollection<T extends {id: string}> = {
    data: IDMappedObjects<T>;
    order: Array<T['id']>;
    errors?: RelationOneToOne<T, Error>;
    warnings?: RelationOneToOne<T, {[Key in keyof T]?: string}>;
};

export type DeepPartial<T> = {

    // For each field of T, make it optional and...
    [K in keyof T]?: (

        // If that field is a Set or a Map, don't go further
        T[K] extends Set<any> ? T[K] :
            T[K] extends Map<any, any> ? T[K] :

            // If that field is an object, make it a deep partial object
                T[K] extends object ? DeepPartial<T[K]> :

                // Else if that field is an optional object, make that a deep partial object
                    T[K] extends object | undefined ? DeepPartial<T[K]> :

                    // Else leave it as an optional primitive
                        T[K]
    );
}

export type ValueOf<T> = T[keyof T];

/**
 * Based on https://stackoverflow.com/a/49725198
 */
export type RequireOnlyOne<T, Keys extends keyof T = keyof T> =
Pick<T, Exclude<keyof T, Keys>> & {[K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>}[Keys];

export type Intersection<T1, T2> =
Omit<Omit<T1&T2, keyof(Omit<T1, keyof(T2)>)>, keyof(Omit<T2, keyof(T1)>)>;

/** https://stackoverflow.com/a/66605669 */
type Only<T, U> = {[P in keyof T]: T[P]} & {[P in keyof U]?: never};
export type Either<T, U> = Only<T, U> | Only<U, T>;

export type PartialExcept<T extends Record<string, unknown>, TKeysNotPartial extends keyof T> = Partial<T> & Pick<T, TKeysNotPartial>;

export function isArrayOf<T>(v: unknown, check: (e: unknown) => boolean): v is T[] {
    if (!Array.isArray(v)) {
        return false;
    }

    return v.every(check);
}

export function isStringArray(v: unknown): v is string[] {
    return isArrayOf(v, (e) => typeof e === 'string');
}

export function isRecordOf<T>(v: unknown, check: (e: unknown) => boolean): v is Record<string, T> {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if (!(Object.keys(v).every((k) => typeof k === 'string'))) {
        return false;
    }

    if (!(Object.values(v).every(check))) {
        return false;
    }

    return true;
}

export const collectionFromArray = <T extends {id: string}>(arr: T[] = []): IDMappedCollection<T> => {
    return arr.reduce((current, item) => {
        current.data = {...current.data, [item.id]: item};
        current.order.push(item.id);
        return current;
    }, {data: {} as IDMappedObjects<T>, order: []} as IDMappedCollection<T>);
};

export const collectionToArray = <T extends {id: string}>({data, order}: IDMappedCollection<T>): T[] => {
    return order.map((id) => data[id]);
};

export const collectionReplaceItem = <T extends {id: string}>(collection: IDMappedCollection<T>, item: T) => {
    return {...collection, data: {...collection.data, [item.id]: item}};
};

export const collectionAddItem = <T extends {id: string}>(collection: IDMappedCollection<T>, item: T) => {
    return {...collection, data: {...collection.data, [item.id]: item}, order: [...collection.order, item.id]};
};

export const collectionRemoveItem = <T extends {id: string}>(collection: IDMappedCollection<T>, item: T) => {
    const data = {...collection.data};
    Reflect.deleteProperty(data, item.id);
    const order = collection.order.filter((id) => id !== item.id);
    return {...collection, data, order};
};

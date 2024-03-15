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

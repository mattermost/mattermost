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
    [P in keyof T]?: DeepPartial<T[P]>;
}

export type ValueOf<T> = T[keyof T];

/**
 * Based on https://stackoverflow.com/a/49725198
 */
export type RequireOnlyOne<T, Keys extends keyof T = keyof T> =
Pick<T, Exclude<keyof T, Keys>> & {[K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>}[Keys];

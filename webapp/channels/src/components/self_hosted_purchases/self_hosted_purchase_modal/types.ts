// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const SetPrefix = 'set_' as const;

export type SetAction<K extends string, V, P extends string=typeof SetPrefix> = {
    type: `${P}${K}`;
    data: V;
}

export type UnionSetActions<T> = {
    [Key in Extract<keyof T, string>]: SetAction<Key, T[Key]>
}[Extract<keyof T, string>]


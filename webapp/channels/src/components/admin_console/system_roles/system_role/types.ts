// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ReadAccess = 'read';
export const readAccess: ReadAccess = 'read';
export type WriteAccess = 'write';
export const writeAccess: WriteAccess = 'write';
export type NoAccess = false;
export const noAccess: NoAccess = false;
export type MixedAccess = 'mixed';
export const mixedAccess: MixedAccess = 'mixed';

export type PermissionAccess = ReadAccess | WriteAccess | NoAccess;
export type PermissionsToUpdate = Record<string, ReadAccess | WriteAccess | NoAccess>;
export type PermissionToUpdate = {
    name: string;
    value: PermissionAccess;
};

export type SystemSection = {
    name: string;
    hasDescription?: boolean;
    subsections?: SystemSection[];
    disabled?: boolean;
}

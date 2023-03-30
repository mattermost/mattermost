// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {cloneDeep} from 'lodash';

import {createSelector} from 'reselect';

import {getMySystemPermissions} from 'mattermost-redux/selectors/entities/roles_helpers';
import {ResourceToSysConsolePermissionsTable, RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from 'components/admin_console/admin_definition';

export const getAdminDefinition = createSelector(
    'getAdminDefinition',
    () => AdminDefinition,
    (state: Record<string, any>) => state.plugins.adminConsoleReducers,
    (adminDefinition, reducers: Record<string, any>) => {
        let result = cloneDeep(AdminDefinition);
        for (const reducer of Object.values(reducers)) {
            result = reducer(result);
        }
        return result;
    },
);

export const getAdminConsoleCustomComponents = (state: Record<string, any>, pluginId: string) =>
    state.plugins.adminConsoleCustomComponents[pluginId] || {};

export const getConsoleAccess = createSelector(
    'getConsoleAccess',
    getAdminDefinition,
    getMySystemPermissions,
    (adminDefinition, mySystemPermissions) => {
        const consoleAccess = {read: {}, write: {}};
        const addEntriesForKey = (entryKey: string) => {
            const permissions = ResourceToSysConsolePermissionsTable[entryKey].filter((x) => mySystemPermissions.has(x));
            Object.assign(consoleAccess.read, {[entryKey]: permissions.length !== 0});
            Object.assign(consoleAccess.write, {[entryKey]: permissions.some((permission) => permission.startsWith('sysconsole_write_'))});
        };
        const mapAccessValuesForKey = ([key]: [string, any]) => {
            const upperKey = key.toUpperCase() as keyof typeof RESOURCE_KEYS;
            if (typeof RESOURCE_KEYS[upperKey] === 'object') {
                Object.values(RESOURCE_KEYS[upperKey]).forEach((entry) => {
                    addEntriesForKey(entry);
                });
            } else {
                addEntriesForKey(key);
            }
        };
        Object.entries(adminDefinition).forEach(mapAccessValuesForKey);
        return consoleAccess;
    },
);

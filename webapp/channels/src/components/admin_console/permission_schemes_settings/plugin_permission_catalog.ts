// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginPermission} from '@mattermost/types/plugins';

import {PermissionsScope} from 'utils/constants';

export type PluginPermissionGroup = {
    pluginId: string;
    pluginName: string;
    permissions: PluginPermission[];
};

let catalog: PluginPermission[] = [];

export function setPluginPermissionCatalog(permissions: PluginPermission[]) {
    catalog = (permissions || []).filter((p) => p.active !== false);
    for (const permission of catalog) {
        (PermissionsScope as Record<string, string>)[permission.permission_id] = permission.scope;
    }
}

export function getPluginPermission(permissionId: string): PluginPermission | undefined {
    return catalog.find((p) => p.permission_id === permissionId);
}

export function getPluginPermissionGroup(pluginId: string): PluginPermissionGroup | undefined {
    const permissions = catalog.filter((p) => p.plugin_id === pluginId);
    if (!permissions.length) {
        return undefined;
    }
    return {
        pluginId,
        pluginName: permissions[0].plugin_name || pluginId,
        permissions,
    };
}

export function getPluginPermissionGroups(): PluginPermissionGroup[] {
    const byPlugin = new Map<string, PluginPermission[]>();
    for (const permission of catalog) {
        const list = byPlugin.get(permission.plugin_id) || [];
        list.push(permission);
        byPlugin.set(permission.plugin_id, list);
    }
    return [...byPlugin.entries()].map(([pluginId, permissions]) => ({
        pluginId,
        pluginName: permissions[0].plugin_name || pluginId,
        permissions,
    }));
}

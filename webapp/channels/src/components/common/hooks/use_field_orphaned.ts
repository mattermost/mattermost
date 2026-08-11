// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';

import {isFieldOrphaned} from 'utils/properties';

import type {GlobalState} from 'types/store';

/**
 * Ids of every plugin the admin console knows to be installed.
 *
 * Two slices are unioned because the attribute pages populate different ones:
 * `admin.plugins` is filled by the admin sidebar's getPlugins() on mount, while
 * `admin.pluginStatuses` is filled by the per-page getPluginStatuses() fetch
 * that resolves server-only plugins. Taking the union keeps a field from
 * reading as orphaned just because the page rendering it loaded only one.
 */
export function useInstalledPluginIds(): ReadonlySet<string> {
    const plugins = useSelector((state: GlobalState) => state.entities.admin.plugins);
    const pluginStatuses = useSelector((state: GlobalState) => state.entities.admin.pluginStatuses);

    return useMemo(
        () => new Set([...Object.keys(plugins ?? {}), ...Object.keys(pluginStatuses ?? {})]),
        [plugins, pluginStatuses],
    );
}

export function useIsFieldOrphaned(field: Pick<PropertyField, 'attrs'>): boolean {
    const installedPluginIds = useInstalledPluginIds();
    return isFieldOrphaned(field, installedPluginIds);
}

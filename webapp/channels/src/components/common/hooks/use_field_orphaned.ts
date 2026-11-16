// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';

import {getPluginStatuses} from 'mattermost-redux/actions/admin';

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
 *
 * Both slices start as `{}`, so an inventory that has not loaded yet is
 * indistinguishable from one where nothing is installed -- and the latter is a
 * real state, since uninstalling the last plugin is exactly when leftovers need
 * cleaning up. Neither this hook nor useIsFieldOrphaned can therefore tell
 * "not known yet" from "nothing installed"; callers that act on the result must
 * gate it on their own fetch having settled (GlobalAttributesTable does this via
 * pluginInventoryLoaded).
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

/**
 * Fetches pluginStatuses once (ref-guarded against re-dispatch on re-render)
 * when `shouldFetch` first becomes true, and reports whether that fetch has
 * settled -- needed by useInstalledPluginIds' own callers to gate orphan
 * detection on the settle-gate documented above (an inventory that hasn't
 * loaded yet is indistinguishable from "nothing installed").
 *
 * `shouldFetch` is a value, not a one-time trigger: passing `false` (e.g. a
 * field known not to be plugin-owned) never dispatches, avoiding the fetch on
 * pages where no row/field needs it.
 */
export function usePluginInventoryLoaded(shouldFetch: boolean): boolean {
    const dispatch = useDispatch();
    const [loaded, setLoaded] = useState(false);
    const requestedRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    useEffect(() => {
        if (!shouldFetch || requestedRef.current) {
            return;
        }
        requestedRef.current = true;
        dispatch(getPluginStatuses()).finally(() => {
            if (isMountedRef.current) {
                setLoaded(true);
            }
        });
    }, [dispatch, shouldFetch]);

    return loaded;
}

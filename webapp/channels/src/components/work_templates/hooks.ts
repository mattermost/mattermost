// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {GlobalState} from 'types/store';
import {PluginComponent} from 'types/store/plugins';

type HookReturnType = {
    pluggableId: string;
    rhsPluggableIds: Map<string, string>;
    pluginComponent?: PluginComponent;
};

export const useGetRHSPluggablesIds = (): HookReturnType => {
    const rhsPlugins = useSelector((state: GlobalState) => state.plugins.components.RightHandSidebarComponent);
    const pluggableId = useSelector((state: GlobalState) => state.views.rhs.pluggableId);

    const rhsPluggableIds: Map<string, string> = new Map<string, string>();
    rhsPlugins.forEach((plugin) => rhsPluggableIds.set(plugin.pluginId, plugin.id));

    const pluginComponent = rhsPlugins.find((element: PluginComponent) => element.id === pluggableId);

    return {pluggableId, rhsPluggableIds, pluginComponent};
};

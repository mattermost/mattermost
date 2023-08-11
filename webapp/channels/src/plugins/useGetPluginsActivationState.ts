// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {GlobalState} from 'types/store';
import {suitePluginIds} from 'utils/constants';
import {useProducts} from 'utils/products';

export const useGetPluginsActivationState = () => {
    const pluginsList = useSelector((state: GlobalState) => state.plugins.plugins);
    const pluginProducts = useProducts();

    let playbooksProductEnabled = false;
    if (pluginProducts) {
        playbooksProductEnabled = pluginProducts.some((product) => product.pluginId === suitePluginIds.playbooks);
    }
    const boardsPlugin = pluginsList.focalboard;
    const playbooksPlugin = pluginsList.playbooks;

    return {boardsPlugin: Boolean(boardsPlugin), playbooksPlugin: Boolean(playbooksPlugin), playbooksProductEnabled};
};

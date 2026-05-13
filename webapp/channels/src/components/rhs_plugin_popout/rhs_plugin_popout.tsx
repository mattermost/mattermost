// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {defineMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import LoadingScreen from 'components/loading_screen';
import SearchResultsHeader from 'components/search_results_header';

import Pluggable from 'plugins/pluggable';
import usePopoutTitle from 'utils/popouts/use_popout_title';

import type {GlobalState} from 'types/store';

export const RHS_PLUGIN_TITLE = defineMessage({
    id: 'rhs_plugin_popout.title',
    // eslint-disable-next-line formatjs/enforce-placeholders -- provided later
    defaultMessage: '{pluginDisplayName} - {serverName}',
});

export default function RhsPluginPopout() {
    const {pluginId} = useParams<{pluginId: string}>();
    const pluginDisplayName = useSelector((state: GlobalState) => (pluginId ? state.plugins.plugins[pluginId]?.name : undefined));
    usePopoutTitle(RHS_PLUGIN_TITLE, {pluginDisplayName: pluginDisplayName ?? pluginId});

    const pluginComponentData = useSelector((state: GlobalState) => {
        const rhsPlugins = state.plugins.components.RightHandSidebarComponent;
        return rhsPlugins.find((element) => element.pluginId === pluginId);
    });

    const {showPluggable, pluggableId, title} = useMemo(() => {
        const pluginTitle = pluginComponentData ? pluginComponentData.title : '';
        const componentId = pluginComponentData ? pluginComponentData.id : '';

        return {
            showPluggable: Boolean(pluginComponentData),
            pluggableId: componentId,
            title: pluginTitle,
        };
    }, [pluginComponentData]);

    if (!showPluggable) {
        return <LoadingScreen/>;
    }

    return (
        <>
            <SearchResultsHeader>
                {title}
            </SearchResultsHeader>
            <Pluggable
                pluggableName='RightHandSidebarComponent'
                pluggableId={pluggableId}
            />
        </>
    );
}


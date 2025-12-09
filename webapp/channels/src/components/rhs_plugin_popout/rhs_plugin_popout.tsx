// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import LoadingScreen from 'components/loading_screen';
import SearchResultsHeader from 'components/search_results_header';

import Pluggable from 'plugins/pluggable';

import type {GlobalState} from 'types/store';

export default function RhsPluginPopout() {
    const {pluginId} = useParams<{pluginId: string}>();

    const {showPluggable, pluggableId, title} = useSelector((state: GlobalState) => {
        const rhsPlugins = state.plugins.components.RightHandSidebarComponent;
        const pluginComponent = rhsPlugins.find((element) => element.pluginId === pluginId);
        const pluginTitle = pluginComponent ? pluginComponent.title : '';
        const componentId = pluginComponent ? pluginComponent.id : '';

        return {
            showPluggable: Boolean(pluginComponent),
            pluggableId: componentId,
            title: pluginTitle,
        };
    });

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


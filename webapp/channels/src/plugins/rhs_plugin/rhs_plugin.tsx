// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {RHS_PLUGIN_TITLE} from 'components/rhs_plugin_popout/rhs_plugin_popout';
import SearchResultsHeader from 'components/search_results_header';

import Pluggable from 'plugins/pluggable';
import {popoutRhsPlugin} from 'utils/popouts/popout_windows';

import type {GlobalState} from 'types/store';

export type Props = {
    showPluggable: boolean;
    pluggableId: string;
    title: React.ReactNode;
    pluginId?: string;
}

const RhsPlugin = ({showPluggable, pluggableId, title, pluginId}: Props) => {
    const intl = useIntl();
    const currentTeam = useSelector(getCurrentTeam);
    const currentChannel = useSelector(getCurrentChannel);
    const pluginDisplayName = useSelector((state: GlobalState) => (pluginId ? state.plugins.plugins[pluginId]?.name : undefined));

    const newWindowHandler = useCallback(() => {
        if (pluginId && currentTeam && currentChannel) {
            popoutRhsPlugin(
                intl.formatMessage(
                    RHS_PLUGIN_TITLE,
                    {
                        pluginDisplayName: pluginDisplayName ?? pluginId,
                        serverName: '{serverName}',
                    },
                ),
                pluginId,
                currentTeam.name,
                currentChannel.name,
            );
        }
    }, [intl, pluginId, currentTeam, currentChannel, pluginDisplayName]);

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <SearchResultsHeader newWindowHandler={newWindowHandler}>
                {title}
            </SearchResultsHeader>
            {
                showPluggable &&
                <Pluggable
                    pluggableName='RightHandSidebarComponent'
                    pluggableId={pluggableId}
                />
            }
        </div>
    );
};

export default React.memo(RhsPlugin);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import SearchResultsHeader from 'components/search_results_header';

import Pluggable from 'plugins/pluggable';
import {popoutRhsPlugin} from 'utils/popouts/popout_windows';

export type Props = {
    showPluggable: boolean;
    pluggableId: string;
    title: React.ReactNode;
    pluginId?: string;
}

const RhsPlugin = ({showPluggable, pluggableId, title, pluginId}: Props) => {
    const intl = useIntl();
    const currentTeam = useSelector(getCurrentTeam);

    const newWindowHandler = useCallback(() => {
        if (pluginId && currentTeam) {
            popoutRhsPlugin(intl, pluginId, currentTeam.name);
        }
    }, [intl, pluginId, currentTeam]);

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

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SearchResultsHeader from 'components/search_results_header';

import Pluggable from 'plugins/pluggable';

export type Props = {
    showPluggable: boolean;
    pluggableId: string;
    title: React.ReactNode;
}

const RhsPlugin: React.FC<Props> = ({ showPluggable, pluggableId, title }) => {
    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body'
        >
            <SearchResultsHeader>
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
}

export default RhsPlugin;
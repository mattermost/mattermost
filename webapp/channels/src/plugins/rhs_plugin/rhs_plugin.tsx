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

export default class RhsPlugin extends React.PureComponent<Props> {
    render() {
        return (
            <div
                id='rhsContainer'
                className='sidebar-right__body'
            >
                <SearchResultsHeader>
                    {this.props.title}
                </SearchResultsHeader>
                {
                    this.props.showPluggable &&
                    <>
                        <Pluggable
                            pluggableName='RightHandSidebarComponent'
                            pluggableId={this.props.pluggableId}
                        />
                    </>
                }
            </div>
        );
    }
}

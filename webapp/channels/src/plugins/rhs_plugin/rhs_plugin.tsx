// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SearchResultsHeader from 'components/search_results_header';

import Pluggable from 'plugins/pluggable';

import AutoShowLinkedBoardTourTip from './auto_show_linked_board_tourtip';

export type Props = {
    showPluggable: boolean;
    pluggableId: string;
    title: React.ReactNode;
}

export default class RhsPlugin extends React.PureComponent<Props> {
    render() {
        const autoLinkedBoardTourTip = (<AutoShowLinkedBoardTourTip/>);

        return (
            <div
                id='rhsContainer'
                className='sidebar-right__body'
            >
                <SearchResultsHeader>
                    {autoLinkedBoardTourTip}
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

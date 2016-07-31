// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import * as GlobalActions from 'actions/global_actions.jsx';
import {getFlaggedPosts} from 'actions/post_actions.jsx';

import {FormattedMessage} from 'react-intl';

const ActionTypes = Constants.ActionTypes;

import React from 'react';

export default class RhsHeaderPost extends React.Component {
    constructor(props) {
        super(props);

        this.handleClose = this.handleClose.bind(this);
        this.toggleSize = this.toggleSize.bind(this);
        this.handleBack = this.handleBack.bind(this);

        this.state = {};
    }
    handleClose(e) {
        e.preventDefault();
        GlobalActions.emitCloseRightHandSide();
        this.props.shrink();
    }
    toggleSize(e) {
        e.preventDefault();
        this.props.toggleSize();
    }
    handleBack(e) {
        e.preventDefault();

        if (this.props.fromSearch) {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH_TERM,
                term: this.props.fromSearch,
                do_search: true,
                is_mention_search: this.props.isMentionSearch
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_SELECTED,
                postId: null
            });
        } else if (this.props.fromFlaggedPosts) {
            getFlaggedPosts();
        }
    }
    render() {
        let back;
        const closeSidebarTooltip = (
            <Tooltip id='closeSidebarTooltip'>
                <FormattedMessage
                    id='rhs_header.closeTooltip'
                    defaultMessage='Close Sidebar'
                />
            </Tooltip>
        );

        let backToResultsTooltip;
        if (this.props.fromSearch) {
            backToResultsTooltip = (
                <Tooltip id='backToResultsTooltip'>
                    <FormattedMessage
                        id='rhs_header.backToResultsTooltip'
                        defaultMessage='Back to Search Results'
                    />
                </Tooltip>
            );
        } else if (this.props.fromFlaggedPosts) {
            backToResultsTooltip = (
                <Tooltip id='backToResultsTooltip'>
                    <FormattedMessage
                        id='rhs_header.backToFlaggedTooltip'
                        defaultMessage='Back to Flagged Posts'
                    />
                </Tooltip>
            );
        }

        const expandSidebarTooltip = (
            <Tooltip id='expandSidebarTooltip'>
                <FormattedMessage
                    id='rhs_header.expandTooltip'
                    defaultMessage='Expand Sidebar'
                />
            </Tooltip>
        );

        const shrinkSidebarTooltip = (
            <Tooltip id='shrinkSidebarTooltip'>
                <FormattedMessage
                    id='rhs_header.expandTooltip'
                    defaultMessage='Shrink Sidebar'
                />
            </Tooltip>
        );

        if (this.props.fromSearch || this.props.fromFlaggedPosts) {
            back = (
                <a
                    href='#'
                    onClick={this.handleBack}
                    className='sidebar--right__back'
                >
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='top'
                        overlay={backToResultsTooltip}
                    >
                        <i className='fa fa-angle-left'></i>
                    </OverlayTrigger>
                </a>
            );
        }

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    {back}
                    <FormattedMessage
                        id='rhs_header.details'
                        defaultMessage='Message Details'
                    />
                </span>
                <div className='pull-right'>
                    <button
                        type='button'
                        className='sidebar--right__expand'
                        aria-label='Expand'
                        onClick={this.toggleSize}
                    >
                        <OverlayTrigger
                            delayShow={Constants.OVERLAY_TIME_DELAY}
                            placement='top'
                            overlay={expandSidebarTooltip}
                        >
                            <i className='fa fa-expand'/>
                        </OverlayTrigger>
                        <OverlayTrigger
                            delayShow={Constants.OVERLAY_TIME_DELAY}
                            placement='top'
                            overlay={shrinkSidebarTooltip}
                        >
                            <i className='fa fa-compress'/>
                        </OverlayTrigger>
                    </button>
                    <button
                        type='button'
                        className='sidebar--right__close'
                        aria-label='Close'
                        onClick={this.handleClose}
                    >

                        <OverlayTrigger
                            delayShow={Constants.OVERLAY_TIME_DELAY}
                            placement='top'
                            overlay={closeSidebarTooltip}
                        >
                            <i className='fa fa-sign-out'/>
                        </OverlayTrigger>
                    </button>
                </div>
            </div>
        );
    }
}

RhsHeaderPost.defaultProps = {
    isMentionSearch: false,
    fromSearch: ''
};
RhsHeaderPost.propTypes = {
    isMentionSearch: React.PropTypes.bool,
    fromSearch: React.PropTypes.string,
    fromFlaggedPosts: React.PropTypes.bool,
    toggleSize: React.PropTypes.function,
    shrink: React.PropTypes.function
};

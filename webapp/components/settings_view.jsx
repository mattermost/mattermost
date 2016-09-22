// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {browserHistory, Link} from 'react-router';

export default class SettingsView extends React.Component {
    static get propTypes() {
        return {
            children: React.PropTypes.node.isRequired,
            title: React.PropTypes.node.isRequired,
            handleClose: React.PropTypes.func,
            closeLink: React.PropTypes.string
        };
    }
    constructor(props) {
        super(props);

        this.handleCloseClicked = this.handleCloseClicked.bind(this);
    }
    handleCloseClicked(e) {
        e.preventDefault();
        if (this.props.handleClose) {
            this.props.handleClose();
        } else {
            browserHistory.goBack();
        }
    }
    render() {
        let closeButton = null;
        if (this.props.closeLink) {
            closeButton = (
                <Link
                    to={this.props.closeLink}
                >
                    <button
                        type='button'
                        className='close'
                    >
                        <span aria-hidden='true'>
                            {'×'}
                        </span>
                    </button>
                </Link>
            );
        } else {
            closeButton = (
                <button
                    type='button'
                    className='close'
                    onClick={this.handleCloseClicked}
                >
                    <span aria-hidden='true'>
                        {'×'}
                    </span>
                </button>
            );
        }

        return (
            <div
                id='app-content'
                key='settings-view'
                className='app__content'
            >
                <div className='modal modal--fullscreen settings-view'>
                    <div className='modal-header'>
                        {closeButton}
                        <h4
                            className='modal-title'
                            ref='title'
                        >
                            {this.props.title}
                        </h4>
                    </div>
                    <div className='modal-body modal-body--invite'>
                        {this.props.children}
                    </div>
                </div>
            </div>
        );
    }
}

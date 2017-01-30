// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

var ActionTypes = Constants.ActionTypes;

import {Modal} from 'react-bootstrap';

import React from 'react';

export default class PostDeletedModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
    }

    shouldComponentUpdate(nextProps) {
        return nextProps.show !== this.props.show;
    }

    handleHide(e) {
        e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH_TERM,
            term: null,
            do_search: false,
            is_mention_search: false
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_POST_SELECTED,
            postId: null
        });

        this.props.onHide();
    }

    render() {
        return (
            <Modal
                show={this.props.show}
                onHide={this.handleHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='post_delete.notPosted'
                            defaultMessage='Comment could not be posted'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        <FormattedMessage
                            id='post_delete.someone'
                            defaultMessage='Someone deleted the message on which you tried to post a comment.'
                        />
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleHide}
                    >
                        <FormattedMessage
                            id='post_delete.okay'
                            defaultMessage='Okay'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

PostDeletedModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};

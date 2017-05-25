// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';

import {Modal} from 'react-bootstrap';

import PropTypes from 'prop-types';

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
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired
};

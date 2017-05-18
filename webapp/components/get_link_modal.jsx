import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import {Modal} from 'react-bootstrap';

export default class GetLinkModal extends React.Component {
    constructor(props) {
        super(props);

        this.onHide = this.onHide.bind(this);

        this.copyLink = this.copyLink.bind(this);

        this.state = {
            copiedLink: false
        };
    }

    onHide() {
        this.setState({copiedLink: false});

        this.props.onHide();
    }

    copyLink() {
        const textarea = this.refs.textarea;
        textarea.focus();
        textarea.setSelectionRange(0, this.props.link.length);

        try {
            if (document.execCommand('copy')) {
                this.setState({copiedLink: true});
            } else {
                this.setState({copiedLink: false});
            }
        } catch (err) {
            this.setState({copiedLink: false});
        }
    }

    render() {
        let helpText = null;
        if (this.props.helpText) {
            helpText = (
                <p>
                    {this.props.helpText}
                    <br/>
                    <br/>
                </p>
            );
        }

        let copyLink = null;
        if (document.queryCommandSupported('copy')) {
            copyLink = (
                <button
                    data-copy-btn='true'
                    type='button'
                    className='btn btn-primary pull-left'
                    onClick={this.copyLink}
                >
                    <FormattedMessage
                        id='get_link.copy'
                        defaultMessage='Copy Link'
                    />
                </button>
            );
        }

        const linkText = (
            <textarea
                className='form-control no-resize min-height'
                ref='textarea'
                value={this.props.link}
                onClick={this.copyLink}
                readOnly={true}
            />
        );

        let copyLinkConfirm = null;
        if (this.state.copiedLink) {
            copyLinkConfirm = (
                <p className='alert alert-success alert--confirm'>
                    <i className='fa fa-check'/>
                    <FormattedMessage
                        id='get_link.clipboard'
                        defaultMessage=' Link copied'
                    />
                </p>
            );
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.onHide}
            >
                <Modal.Header closeButton={true}>
                    <h4 className='modal-title'>{this.props.title}</h4>
                </Modal.Header>
                <Modal.Body>
                    {helpText}
                    {linkText}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='get_link.close'
                            defaultMessage='Close'
                        />
                    </button>
                    {copyLink}
                    {copyLinkConfirm}
                </Modal.Footer>
            </Modal>
        );
    }
}

GetLinkModal.propTypes = {
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    helpText: PropTypes.string,
    link: PropTypes.string.isRequired
};

GetLinkModal.defaultProps = {
    helpText: null
};

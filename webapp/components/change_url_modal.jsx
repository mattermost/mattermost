// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';
import Constants from 'utils/constants.jsx';
import {Modal, Tooltip, OverlayTrigger} from 'react-bootstrap';
import TeamStore from 'stores/team_store.jsx';
import * as URL from 'utils/url.jsx';

import {FormattedMessage} from 'react-intl';

import PropTypes from 'prop-types';

import React from 'react';

export default class ChangeUrlModal extends React.Component {
    constructor(props) {
        super(props);

        this.onURLChanged = this.onURLChanged.bind(this);
        this.doSubmit = this.doSubmit.bind(this);
        this.doCancel = this.doCancel.bind(this);

        this.state = {
            currentURL: props.currentURL,
            urlError: '',
            userEdit: false
        };
    }

    componentWillReceiveProps(nextProps) {
        // This check prevents the url being deleted when we re-render
        // because of user status check
        if (!this.state.userEdit) {
            this.setState({
                currentURL: nextProps.currentURL
            });
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.show === true && prevProps.show === false) {
            ReactDOM.findDOMNode(this.refs.urlinput).select();
        }
    }

    onURLChanged(e) {
        const url = e.target.value.trim();
        this.setState({currentURL: url.replace(/[^A-Za-z0-9-_]/g, '').toLowerCase(), userEdit: true});
    }

    getURLError(url) {
        let error = []; //eslint-disable-line prefer-const
        if (url.length < 2) {
            error.push(
                <span key='error1'>
                    <FormattedMessage
                        id='change_url.longer'
                        defaultMessage='URL must be two or more characters.'
                    />
                    <br/>
                </span>
            );
        }
        if (url.charAt(0) === '-' || url.charAt(0) === '_') {
            error.push(
                <span key='error2'>
                    <FormattedMessage
                        id='change_url.startWithLetter'
                        defaultMessage='URL must start with a letter or number.'
                    />
                    <br/>
                </span>
            );
        }
        if (url.length > 1 && (url.charAt(url.length - 1) === '-' || url.charAt(url.length - 1) === '_')) {
            error.push(
                <span key='error3'>
                    <FormattedMessage
                        id='change_url.endWithLetter'
                        defaultMessage='URL must end with a letter or number.'
                    />
                    <br/>
                </span>);
        }
        if (url.indexOf('__') > -1) {
            error.push(
                <span key='error4'>
                    <FormattedMessage
                        id='change_url.noUnderscore'
                        defaultMessage='URL can not contain two underscores in a row.'
                    />
                    <br/>
                </span>);
        }

        // In case of error we don't detect
        if (error.length === 0) {
            error.push(
                <span key='errorlast'>
                    <FormattedMessage
                        id='change_url.invalidUrl'
                        defaultMessage='Invalid URL'
                    />
                    <br/>
                </span>);
        }
        return error;
    }

    doSubmit(e) {
        e.preventDefault();

        const url = ReactDOM.findDOMNode(this.refs.urlinput).value;
        const cleanedURL = URL.cleanUpUrlable(url);
        if (cleanedURL !== url || url.length < 2 || url.indexOf('__') > -1) {
            this.setState({urlError: this.getURLError(url)});
            return;
        }
        this.setState({urlError: '', userEdit: false});
        this.props.onModalSubmit(url);
    }

    doCancel() {
        this.setState({urlError: '', userEdit: false});
        this.props.onModalDismissed();
    }

    render() {
        let urlClass = 'input-group input-group--limit';
        let error = null;

        if (this.state.urlError) {
            urlClass += ' has-error';
        }

        if (this.props.serverError || this.state.urlError) {
            error = (
                <div className='form-group has-error'>
                    <p className='input__help error'>
                        {this.state.urlError || this.props.serverError}
                    </p>
                </div>
            );
        }

        const fullUrl = TeamStore.getCurrentTeamUrl() + '/channels';
        const shortURL = URL.getShortenedURL(fullUrl);
        const urlTooltip = (
            <Tooltip id='urlTooltip'>{fullUrl}</Tooltip>
        );

        return (
            <Modal
                show={this.props.show}
                onHide={this.doCancel}
                onExited={this.props.onModalExited}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{this.props.title}</Modal.Title>
                </Modal.Header>
                <form
                    role='form'
                    className='form-horizontal'
                >
                    <Modal.Body>
                        <div className='modal-intro'>
                            <FormattedMessage
                                id='channel_flow.changeUrlDescription'
                                defaultMessage='Some characters are now allowed in URLs and may be removed.'
                            />
                        </div>
                        <div className='form-group'>
                            <label className='col-sm-2 form__label control-label'>
                                <FormattedMessage
                                    id='change_url.urlLabel'
                                    defaultMessage='Channel URL'
                                />
                            </label>
                            <div className='col-sm-10'>
                                <div className={urlClass}>
                                    <OverlayTrigger
                                        trigger={['hover', 'focus']}
                                        delayShow={Constants.OVERLAY_TIME_DELAY}
                                        placement='top'
                                        overlay={urlTooltip}
                                    >
                                        <span className='input-group-addon'>{shortURL}</span>
                                    </OverlayTrigger>
                                    <input
                                        type='text'
                                        ref='urlinput'
                                        className='form-control'
                                        maxLength={Constants.MAX_CHANNELNAME_LENGTH}
                                        onChange={this.onURLChanged}
                                        value={this.state.currentURL}
                                        autoFocus={true}
                                        tabIndex='1'
                                    />
                                </div>
                                {error}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.doCancel}
                        >
                            <FormattedMessage
                                id='change_url.close'
                                defaultMessage='Close'
                            />
                        </button>
                        <button
                            onClick={this.doSubmit}
                            type='submit'
                            className='btn btn-primary'
                            tabIndex='2'
                        >
                            {this.props.submitButtonText}
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

ChangeUrlModal.defaultProps = {
    show: false,
    title: 'Change URL',
    submitButtonText: 'Save',
    currentURL: '',
    serverError: null
};

ChangeUrlModal.propTypes = {
    show: PropTypes.bool.isRequired,
    title: PropTypes.node,
    submitButtonText: PropTypes.node,
    currentURL: PropTypes.string,
    serverError: PropTypes.node,
    onModalSubmit: PropTypes.func.isRequired,
    onModalExited: PropTypes.func,
    onModalDismissed: PropTypes.func.isRequired
};

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';
import {browserHistory} from 'react-router/es6';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import {cleanUpUrlable, getShortenedURL} from 'utils/url.jsx';

import TeamStore from 'stores/team_store.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';
import {updateChannel} from 'actions/channel_actions.jsx';

import {Modal, Tooltip, OverlayTrigger} from 'react-bootstrap';

const holders = defineMessages({
    required: {
        id: 'rename_channel.required',
        defaultMessage: 'This field is required'
    },
    maxLength: {
        id: 'rename_channel.maxLength',
        defaultMessage: 'This field must be less than {maxLength, number} characters'
    },
    lowercase: {
        id: 'rename_channel.lowercase',
        defaultMessage: 'Must be lowercase alphanumeric characters'
    },
    url: {
        id: 'rename_channel.url',
        defaultMessage: 'URL'
    },
    defaultError: {
        id: 'rename_channel.defaultError',
        defaultMessage: ' - Cannot be changed for the default channel'
    },
    displayNameHolder: {
        id: 'rename_channel.displayNameHolder',
        defaultMessage: 'Enter display name'
    },
    handleHolder: {
        id: 'rename_channel.handleHolder',
        defaultMessage: 'lowercase alphanumeric characters'
    }
});

import PropTypes from 'prop-types';

import React from 'react';

export class RenameChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleShow = this.handleShow.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCancel = this.handleCancel.bind(this);

        this.onNameChange = this.onNameChange.bind(this);
        this.onDisplayNameChange = this.onDisplayNameChange.bind(this);

        this.state = {
            displayName: props.channel.display_name,
            channelName: props.channel.name,
            serverError: '',
            nameError: '',
            displayNameError: '',
            invalid: false
        };
    }

    componentWillReceiveProps(nextProps) {
        if (!Utils.areObjectsEqual(nextProps.channel, this.props.channel)) {
            this.setState({
                displayName: nextProps.channel.display_name,
                channelName: nextProps.channel.name
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!nextProps.show && !this.props.show) {
            return false;
        }

        if (!Utils.areObjectsEqual(nextState, this.state)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps, this.props)) {
            return true;
        }

        return false;
    }

    componentDidUpdate(prevProps) {
        if (!prevProps.show && this.props.show) {
            this.handleShow();
        }
    }

    handleShow() {
        const textbox = ReactDOM.findDOMNode(this.refs.displayName);
        textbox.focus();
        Utils.placeCaretAtEnd(textbox);
    }

    handleHide(e) {
        if (e) {
            e.preventDefault();
        }

        this.props.onHide();

        this.setState({
            serverError: '',
            nameError: '',
            displayNameError: '',
            invalid: false
        });
    }

    handleSubmit(e) {
        e.preventDefault();

        const channel = Object.assign({}, this.props.channel);
        const oldName = channel.name;
        const oldDisplayName = channel.display_name;
        const state = {serverError: ''};
        const {formatMessage} = this.props.intl;

        channel.display_name = this.state.displayName.trim();
        if (!channel.display_name) {
            state.displayNameError = formatMessage(holders.required);
            state.invalid = true;
        } else if (channel.display_name.length > Constants.MAX_CHANNELNAME_LENGTH) {
            state.displayNameError = formatMessage(holders.maxLength, {maxLength: Constants.MAX_CHANNELNAME_LENGTH});
            state.invalid = true;
        } else {
            state.displayNameError = '';
        }

        channel.name = this.state.channelName.trim();
        if (!channel.name) {
            state.nameError = formatMessage(holders.required);
            state.invalid = true;
        } else if (channel.name.length > Constants.MAX_CHANNELNAME_LENGTH) {
            state.nameError = formatMessage(holders.maxLength, {maxLength: Constants.MAX_CHANNELNAME_LENGTH});
            state.invalid = true;
        } else {
            const cleanedName = cleanUpUrlable(channel.name);
            if (cleanedName === channel.name) {
                state.nameError = '';
            } else {
                state.nameError = formatMessage(holders.lowercase);
                state.invalid = true;
            }
        }

        this.setState(state);

        if (state.invalid || (oldName === channel.name && oldDisplayName === channel.display_name)) {
            return;
        }

        updateChannel(channel,
            (data) => {
                this.handleHide();
                const team = TeamStore.get(data.team_id);
                browserHistory.push('/' + team.name + '/channels/' + data.name);
            },
            (err) => {
                this.setState({
                    serverError: err.message,
                    invalid: true
                });
            }
        );
    }

    handleCancel(e) {
        this.setState({
            displayName: this.props.channel.display_name,
            channelName: this.props.channel.name
        });

        this.handleHide(e);
    }

    onNameChange() {
        this.setState({channelName: ReactDOM.findDOMNode(this.refs.channelName).value});
    }

    onDisplayNameChange() {
        this.setState({displayName: ReactDOM.findDOMNode(this.refs.displayName).value});
    }

    render() {
        let displayNameError = null;
        let displayNameClass = 'form-group';
        if (this.state.displayNameError) {
            displayNameError = <label className='control-label'>{this.state.displayNameError}</label>;
            displayNameClass += ' has-error';
        }

        let nameError = null;
        let nameClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameClass += ' has-error';
        }

        let serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        const {formatMessage} = this.props.intl;

        let urlInputLabel = formatMessage(holders.url);
        const handleInputClass = 'form-control';
        let readOnlyHandleInput = false;
        if (this.state.channelName === Constants.DEFAULT_CHANNEL) {
            urlInputLabel += formatMessage(holders.defaultError);
            readOnlyHandleInput = true;
        }

        const fullUrl = TeamStore.getCurrentTeamUrl() + '/channels';
        const shortUrl = getShortenedURL(fullUrl, 35);
        const urlTooltip = (
            <Tooltip id='urlTooltip'>{fullUrl}</Tooltip>
        );

        return (
            <Modal
                show={this.props.show}
                onHide={this.handleCancel}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='rename_channel.title'
                            defaultMessage='Rename Channel'
                        />
                    </Modal.Title>
                </Modal.Header>
                <form role='form'>
                    <Modal.Body>
                        <div className={displayNameClass}>
                            <label className='control-label'>
                                <FormattedMessage
                                    id='rename_channel.displayName'
                                    defaultMessage='Display Name'
                                />
                            </label>
                            <input
                                onChange={this.onDisplayNameChange}
                                type='text'
                                ref='displayName'
                                id='display_name'
                                className='form-control'
                                placeholder={formatMessage(holders.displayNameHolder)}
                                value={this.state.displayName}
                                maxLength={Constants.MAX_CHANNELNAME_LENGTH}
                            />
                            {displayNameError}
                        </div>
                        <div className={nameClass}>
                            <label className='control-label'>{urlInputLabel}</label>

                            <div className='input-group input-group--limit'>
                                <OverlayTrigger
                                    trigger={['hover', 'focus']}
                                    delayShow={Constants.OVERLAY_TIME_DELAY}
                                    placement='top'
                                    overlay={urlTooltip}
                                >
                                    <span className='input-group-addon'>{shortUrl}</span>
                                </OverlayTrigger>
                                <input
                                    onChange={this.onNameChange}
                                    type='text'
                                    className={handleInputClass}
                                    ref='channelName'
                                    placeholder={formatMessage(holders.handleHolder)}
                                    value={this.state.channelName}
                                    maxLength={Constants.MAX_CHANNELNAME_LENGTH}
                                    readOnly={readOnlyHandleInput}
                                />
                            </div>
                            {nameError}
                        </div>
                        {serverError}
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.handleCancel}
                        >
                            <FormattedMessage
                                id='rename_channel.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
                        <button
                            onClick={this.handleSubmit}
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='rename_channel.save'
                                defaultMessage='Save'
                            />
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

RenameChannelModal.propTypes = {
    intl: intlShape.isRequired,
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
    channel: PropTypes.object.isRequired
};

export default injectIntl(RenameChannelModal);

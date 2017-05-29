// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Textbox from './textbox.jsx';

import ReactDOM from 'react-dom';
import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';
import {updateChannelHeader} from 'actions/channel_actions.jsx';
import * as UserAgent from 'utils/user_agent.jsx';

const KeyCodes = Constants.KeyCodes;

import {Modal} from 'react-bootstrap';

const holders = defineMessages({
    error: {
        id: 'edit_channel_header_modal.error',
        defaultMessage: 'This channel header is too long, please enter a shorter one'
    }
});

import PropTypes from 'prop-types';

import React from 'react';

class EditChannelHeaderModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleEditKeyPress = this.handleEditKeyPress.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);
        this.handlePostError = this.handlePostError.bind(this);
        this.focusTextbox = this.focusTextbox.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);

        this.ctrlSend = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter');

        this.state = {
            header: props.channel.header,
            show: true,
            serverError: '',
            submitted: false
        };
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        this.onShow();
        this.focusTextbox();
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }

    handleChange(e) {
        this.setState({
            header: e.target.value
        });
    }

    onPreferenceChange() {
        this.ctrlSend = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter');
    }

    handleSubmit() {
        this.setState({submitted: true});

        updateChannelHeader(
            this.props.channel.id,
            this.state.header,
            () => {
                this.setState({serverError: ''});
                this.onHide();
            },
            (err) => {
                if (err.id === 'api.context.invalid_param.app_error') {
                    this.setState({serverError: this.props.intl.formatMessage(holders.error)});
                } else {
                    this.setState({serverError: err.message});
                }
            }
        );
    }

    onShow() {
        this.submitted = false;
    }

    onHide() {
        this.setState({show: false});
    }

    focusTextbox() {
        if (!Utils.isMobile()) {
            this.refs.textbox.focus();
        }
    }

    handleKeyDown(e) {
        if (this.ctrlSend && e.keyCode === Constants.KeyCodes.ENTER && e.ctrlKey) {
            e.preventDefault();
            this.handleSubmit(e);
        } else if (!this.ctrlSend && e.keyCode === Constants.KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.handleSubmit(e);
        }
    }

    handleEditKeyPress(e) {
        if (!UserAgent.isMobile() && !this.state.ctrlSend && e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            ReactDOM.findDOMNode(this.refs.editbox).blur();
            this.handleEdit();
        } else if (this.state.ctrlSend && e.ctrlKey && e.which === KeyCodes.ENTER) {
            e.preventDefault();
            ReactDOM.findDOMNode(this.refs.editbox).blur();
            this.handleEdit();
        }
    }

    handlePostError(postError) {
        this.setState({serverError: postError});
    }

    render() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><br/><label className='control-label'>{this.state.serverError}</label></div>;
        }

        let headerTitle = null;
        if (this.props.channel.type === Constants.DM_CHANNEL) {
            headerTitle = (
                <FormattedMessage
                    id='edit_channel_header_modal.title_dm'
                    defaultMessage='Edit Header'
                />
            );
        } else {
            headerTitle = (
                <FormattedMessage
                    id='edit_channel_header_modal.title'
                    defaultMessage='Edit Header for {channel}'
                    values={{
                        channel: this.props.channel.display_name
                    }}
                />
            );
        }

        return (
            <Modal
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        {headerTitle}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='edit-modal-body'>
                        <p>
                            <FormattedMessage
                                id='edit_channel_header_modal.description'
                                defaultMessage='Edit the text appearing next to the channel name in the channel header.'
                            />
                        </p>
                        <Textbox
                            value={this.state.header}
                            onChange={this.handleChange}
                            onKeyPress={this.handleEditKeyPress}
                            onKeyDown={this.handleKeyDown}
                            supportsCommands={false}
                            suggestionListStyle='bottom'
                            createMessage={Utils.localizeMessage('edit_channel_header.editHeader', 'Edit the Channel Header...')}
                            previewMessageLink={Utils.localizeMessage('edit_channel_header.previewHeader', 'Edit Header')}
                            handlePostError={this.handlePostError}
                            id='edit_textbox'
                            ref='textbox'
                        />
                        <br/>
                        {serverError}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='edit_channel_header_modal.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        disabled={this.state.submitted}
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleSubmit}
                    >
                        <FormattedMessage
                            id='edit_channel_header_modal.save'
                            defaultMessage='Save'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

EditChannelHeaderModal.propTypes = {
    intl: intlShape.isRequired,
    onHide: PropTypes.func.isRequired,
    channel: PropTypes.object.isRequired
};

export default injectIntl(EditChannelHeaderModal);

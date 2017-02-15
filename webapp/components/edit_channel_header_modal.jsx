// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';
import {updateChannelHeader} from 'actions/channel_actions.jsx';

import Textbox from './textbox.jsx';

import {Modal} from 'react-bootstrap';

const holders = defineMessages({
    error: {
        id: 'edit_channel_header_modal.error',
        defaultMessage: 'This channel header is too long, please enter a shorter one'
    }
});

import React from 'react';

class EditChannelHeaderModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handlePostError = this.handlePostError.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);

        this.ctrlSend = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter');

        this.state = {
            header: props.channel.header,
            show: true,
            serverError: '',
            canSubmit: false
        };
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }

    handleChange(e) {
        if (e.target.value === this.props.channel.header) {
            this.setState({canSubmit: false});
            return;
        }
        this.setState({
            header: e.target.value,
            canSubmit: true
        });
    }

    onPreferenceChange() {
        this.ctrlSend = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter');
    }

    handleSubmit() {
        if (!this.state.canSubmit) {
            return;
        }
        this.setState({canSubmit: false});

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

    handlePostError(postError) {
        this.setState({serverError: postError});
    }

    onHide() {
        this.setState({show: false});
    }

    handleKeyPress(e) {
        if (this.ctrlSend && e.keyCode === Constants.KeyCodes.ENTER && e.ctrlKey) {
            e.preventDefault();
            this.handleSubmit(e);
        } else if (!this.ctrlSend && e.keyCode === Constants.KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.handleSubmit(e);
        }
    }

    render() {
        var serverError = <p><br/></p>;
        if (this.state.serverError) {
            serverError = <div className='has-error'><br/><label className='control-label'>{this.state.serverError}</label></div>;
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
                    <p>
                        <FormattedMessage
                            id='edit_channel_header_modal.description'
                            defaultMessage='Edit the text appearing next to the channel name in the channel header.'
                        />
                    </p>
                    <Textbox
                        ref='textbox'
                        onChange={this.handleChange}
                        onKeyPress={this.handleKeyPress}
                        handlePostError={this.handlePostError}
                        value={this.state.header}
                        initialText=''
                        channelId={this.props.channel.id}
                        createMessage={Utils.localizeMessage('edit_channel_header.addHeader', 'Add a header...')}
                        suggestionListStyle='bottom'
                        id='edit_header'
                        rows='4'
                    />
                    {serverError}
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
                        disabled={!this.state.canSubmit}
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
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};

export default injectIntl(EditChannelHeaderModal);

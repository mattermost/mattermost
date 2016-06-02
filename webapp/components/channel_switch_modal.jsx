// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SuggestionList from './suggestion/suggestion_list.jsx';
import SuggestionBox from './suggestion/suggestion_box.jsx';
import SwitchChannelProvider from './suggestion/switch_channel_provider.jsx';
import {FormattedMessage} from 'react-intl';
import {Modal} from 'react-bootstrap';
import * as Utils from 'utils/utils.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import Constants from 'utils/constants.jsx';
import * as ChannelActions from 'actions/channel_actions.jsx';
import React from 'react';

export default class SwitchChannelModal extends React.Component {
    constructor() {
        super();

        this.onUserInput = this.onUserInput.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.suggestionProviders = [new SwitchChannelProvider()];

        this.state = {
            text: '',
            error: ''
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            const textbox = this.refs.search.getTextbox();
            textbox.focus();
            Utils.placeCaretAtEnd(textbox);
        }
    }

    onShow() {
        this.setState({
            text: '',
            error: ''
        });
    }

    onHide() {
        this.setState({
            text: '',
            error: ''
        });
        this.props.onHide();
    }

    onUserInput(message) {
        this.setState({text: message});
    }

    handleKeyDown(e) {
        this.setState({
            error: ''
        });
        if (e.keyCode === Constants.KeyCodes.ENTER) {
            this.handleSubmit();
        }
    }

    handleSubmit() {
        const channel = ChannelStore.getByName(this.state.text.trim());
        if (channel !== null && channel.name === this.state.text.trim() && channel.type !== Constants.DM_CHANNEL) {
            ChannelActions.goToChannel(channel);
            this.onHide();
        } else if (this.state.text !== '') {
            this.setState({
                error: Utils.localizeMessage('channel_switch_modal.not_found', 'No matches found.')
            });
        }
    }

    render() {
        let message = this.state.error;
        return (
            <Modal
                className='modal-browse-channel'
                ref='modal'
                show={this.props.show}
                onHide={this.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <span>
                            <FormattedMessage
                                id='channel_switch_modal.title'
                                defaultMessage='Switch Channels'
                            />
                        </span>
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    <FormattedMessage
                        id='channel_switch_modal.help'
                        defaultMessage='↑↓ to browse, TAB to select, ↵ to confirm, ESC to dismiss'
                    />
                    <SuggestionBox
                        ref='search'
                        className='form-control focused'
                        type='input'
                        onUserInput={this.onUserInput}
                        value={this.state.text}
                        onKeyDown={this.handleKeyDown}
                        listComponent={SuggestionList}
                        maxLength='64'
                        providers={this.suggestionProviders}
                        preventDefaultSubmit={false}
                        listStyle='bottom'
                    />
                </Modal.Body>
                <Modal.Footer>
                    <label className='control-label'>
                        {message}
                    </label>
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
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleSubmit}
                    >
                        <FormattedMessage
                            id='channel_switch_modal.submit'
                            defaultMessage='Switch'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

SwitchChannelModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};


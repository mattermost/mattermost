// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SuggestionList from './suggestion/suggestion_list.jsx';
import SuggestionBox from './suggestion/suggestion_box.jsx';
import SwitchChannelProvider from './suggestion/switch_channel_provider.jsx';

import {FormattedMessage} from 'react-intl';
import {Modal} from 'react-bootstrap';

import {goToChannel, openDirectChannelToUser} from 'actions/channel_actions.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import $ from 'jquery';

export default class SwitchChannelModal extends React.Component {
    static propTypes = {
        show: PropTypes.bool.isRequired,
        onHide: PropTypes.func.isRequired
    }

    constructor() {
        super();

        this.onChange = this.onChange.bind(this);
        this.onItemSelected = this.onItemSelected.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onExited = this.onExited.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.switchToChannel = this.switchToChannel.bind(this);

        this.suggestionProviders = [new SwitchChannelProvider()];

        this.state = {
            text: ''
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
            text: ''
        });
    }

    onHide() {
        this.setState({
            text: ''
        });
        this.props.onHide();
    }

    onExited() {
        this.selected = null;
        setTimeout(() => {
            $('#post_textbox').get(0).focus();
        });
    }

    onChange(e) {
        this.setState({text: e.target.value});
        this.selected = null;
    }

    onItemSelected(item) {
        this.selected = item;
    }

    handleKeyDown(e) {
        if (e.keyCode === Constants.KeyCodes.ENTER) {
            this.handleSubmit();
        }
    }

    handleSubmit() {
        let channel = null;

        if (!this.selected) {
            return;
        }

        if (this.selected.type === Constants.DM_CHANNEL) {
            const user = UserStore.getProfileByUsername(this.selected.name);

            if (user) {
                openDirectChannelToUser(
                    user.id,
                    (ch) => {
                        channel = ch;
                        this.switchToChannel(channel);
                    },
                    () => {
                        channel = null;
                        this.switchToChannel(channel);
                    }
                );
            }
        } else {
            channel = ChannelStore.get(this.selected.id);
            this.switchToChannel(channel);
        }
    }

    switchToChannel(channel) {
        if (channel != null) {
            goToChannel(channel);
            this.onHide();
        }
    }

    render() {
        return (
            <Modal
                dialogClassName='channel-switch-modal modal--overflow'
                ref='modal'
                show={this.props.show}
                onHide={this.onHide}
                onExited={this.onExited}
            >
                <Modal.Body>
                    <div className='modal__hint'>
                        <FormattedMessage
                            id='channel_switch_modal.help'
                            defaultMessage='Type channel name. Use ↑↓ to browse, TAB to select, ↵ to confirm, ESC to dismiss'
                        />
                    </div>
                    <SuggestionBox
                        ref='search'
                        className='form-control focused'
                        type='input'
                        onChange={this.onChange}
                        value={this.state.text}
                        onKeyDown={this.handleKeyDown}
                        onItemSelected={this.onItemSelected}
                        listComponent={SuggestionList}
                        maxLength='64'
                        providers={this.suggestionProviders}
                        listStyle='bottom'
                    />
                </Modal.Body>
            </Modal>
        );
    }
}

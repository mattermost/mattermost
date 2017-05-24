// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SuggestionList from 'components/suggestion/suggestion_list.jsx';
import SuggestionBox from 'components/suggestion/suggestion_box.jsx';
import SwitchChannelProvider from 'components/suggestion/switch_channel_provider.jsx';
import SwitchTeamProvider from 'components/suggestion/switch_team_provider.jsx';

import {goToChannel, openDirectChannelToUser} from 'actions/channel_actions.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import {browserHistory} from 'react-router/es6';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

// Redux actions
import store from 'stores/redux_store.jsx';
const getState = store.getState;

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getUserByUsername} from 'mattermost-redux/selectors/entities/users';

const CHANNEL_MODE = 'channel';
const TEAM_MODE = 'team';

export default class QuickSwitchModal extends React.PureComponent {
    static propTypes = {

        /**
         * The mode to start in when showing the modal, either 'channel' or 'team'
         */
        initialMode: PropTypes.string.isRequired,

        /**
         * Set to show the modal
         */
        show: PropTypes.bool.isRequired,

        /**
         * The function called to hide the modal
         */
        onHide: PropTypes.func.isRequired,

        /**
         * Set to show team switcher
         */
        showTeamSwitcher: PropTypes.bool
    }

    static defaultProps = {
        initialMode: CHANNEL_MODE
    }

    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onItemSelected = this.onItemSelected.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onExited = this.onExited.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.switchToChannel = this.switchToChannel.bind(this);
        this.switchMode = this.switchMode.bind(this);

        this.channelProviders = [new SwitchChannelProvider()];
        this.teamProviders = [new SwitchTeamProvider()];

        this.state = {
            text: '',
            mode: props.initialMode
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            const textbox = this.refs.switchbox.getTextbox();
            textbox.focus();
            Utils.placeCaretAtEnd(textbox);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (!this.props.show && nextProps.show) {
            this.setState({mode: nextProps.initialMode});
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
        } else if (e.keyCode === Constants.KeyCodes.TAB) {
            e.preventDefault();
            this.switchMode();
        }
    }

    handleSubmit() {
        let channel = null;

        if (!this.selected) {
            return;
        }

        if (this.state.mode === CHANNEL_MODE) {
            const selected = this.selected.channel;
            if (selected.type === Constants.DM_CHANNEL) {
                const user = getUserByUsername(getState(), selected.name);

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
                channel = getChannel(getState(), selected.id);
                this.switchToChannel(channel);
            }
        } else {
            browserHistory.push('/' + this.selected.name);
            this.onHide();
        }
    }

    switchToChannel(channel) {
        if (channel != null) {
            goToChannel(channel);
            this.onHide();
        }
    }

    switchMode() {
        if (this.state.mode === CHANNEL_MODE && this.props.showTeamSwitcher) {
            this.setState({mode: TEAM_MODE});
        } else if (this.state.mode === TEAM_MODE) {
            this.setState({mode: CHANNEL_MODE});
        }
    }

    render() {
        let providers = this.channelProviders;
        let header;
        let renderDividers = true;
        if (this.props.showTeamSwitcher) {
            const channelStyle = {};
            const teamStyle = {marginLeft: '50px'};
            if (this.state.mode === TEAM_MODE) {
                providers = this.teamProviders;
                renderDividers = false;
                teamStyle.fontWeight = 'bold';
            } else {
                channelStyle.fontWeight = 'bold';
            }

            header = (
                <div>
                    <span style={channelStyle}>
                        <FormattedMessage
                            id='quick_switch_modal.channels'
                            defaultMessage='Channels'
                        />
                    </span>
                    <span style={teamStyle}>
                        <FormattedMessage
                            id='quick_switch_modal.teams'
                            defaultMessage='Teams'
                        />
                    </span>
                </div>
            );
        }

        let help;
        if (this.props.showTeamSwitcher) {
            help = (
                <FormattedMessage
                    id='quick_switch_modal.help'
                    defaultMessage='Use TAB to toggle between teams/channels, ↑↓ to browse, ↵ to confirm, ESC to dismiss'
                />
            );
        } else {
            help = (
                <FormattedMessage
                    id='quick_switch_modal.help_no_team'
                    defaultMessage='Type a channel name. Use ↑↓ to browse, ↵ to confirm, ESC to dismiss'
                />
            );
        }

        return (
            <Modal
                dialogClassName='channel-switch-modal modal--overflow'
                ref='modal'
                show={this.props.show}
                onHide={this.onHide}
                onExited={this.onExited}
            >
                <Modal.Body>
                    {header}
                    <div className='modal__hint'>
                        {help}
                    </div>
                    <SuggestionBox
                        ref='switchbox'
                        className='form-control focused'
                        type='input'
                        onChange={this.onChange}
                        value={this.state.text}
                        onKeyDown={this.handleKeyDown}
                        onItemSelected={this.onItemSelected}
                        listComponent={SuggestionList}
                        maxLength='64'
                        providers={providers}
                        listStyle='bottom'
                        completeOnTab={false}
                        renderDividers={renderDividers}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}

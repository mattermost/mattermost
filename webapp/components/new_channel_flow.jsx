// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import TeamStore from 'stores/team_store.jsx';
import {cleanUpUrlable} from 'utils/url.jsx';

import NewChannelModal from 'components/new_channel_modal';
import ChangeURLModal from './change_url_modal.jsx';

import {FormattedMessage} from 'react-intl';
import {createChannel} from 'actions/channel_actions.jsx';
import {browserHistory} from 'react-router/es6';

const SHOW_NEW_CHANNEL = 1;
const SHOW_EDIT_URL = 2;
const SHOW_EDIT_URL_THEN_COMPLETE = 3;

import PropTypes from 'prop-types';

import React from 'react';

export default class NewChannelFlow extends React.Component {
    constructor(props) {
        super(props);

        this.doSubmit = this.doSubmit.bind(this);
        this.onModalExited = this.onModalExited.bind(this);
        this.typeSwitched = this.typeSwitched.bind(this);
        this.urlChangeRequested = this.urlChangeRequested.bind(this);
        this.urlChangeSubmitted = this.urlChangeSubmitted.bind(this);
        this.urlChangeDismissed = this.urlChangeDismissed.bind(this);
        this.channelDataChanged = this.channelDataChanged.bind(this);

        this.state = {
            serverError: '',
            channelType: 'O',
            flowState: SHOW_NEW_CHANNEL,
            channelDisplayName: '',
            channelName: '',
            channelPurpose: '',
            channelHeader: '',
            nameModified: false
        };
    }
    componentWillReceiveProps(nextProps) {
        // If we are being shown, grab channel type from props and clear
        if (nextProps.show === true && this.props.show === false) {
            this.setState({
                serverError: '',
                channelType: nextProps.channelType,
                flowState: SHOW_NEW_CHANNEL,
                channelDisplayName: '',
                channelName: '',
                channelPurpose: '',
                channelHeader: '',
                nameModified: false
            });
        }
    }
    doSubmit() {
        if (!this.state.channelDisplayName) {
            this.setState({serverError: Utils.localizeMessage('channel_flow.invalidName', 'Invalid Channel Name')});
            return;
        }

        if (this.state.channelName < 2) {
            this.setState({flowState: SHOW_EDIT_URL_THEN_COMPLETE});
            return;
        }

        const channel = {
            team_id: TeamStore.getCurrentId(),
            name: this.state.channelName,
            display_name: this.state.channelDisplayName,
            purpose: this.state.channelPurpose,
            header: this.state.channelHeader,
            type: this.state.channelType
        };

        createChannel(
            channel,
            (data) => {
                this.doOnModalExited = () => {
                    browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + data.name);
                };

                this.props.onModalDismissed();
            },
            (err) => {
                if (err.id === 'model.channel.is_valid.2_or_more.app_error') {
                    this.setState({
                        flowState: SHOW_EDIT_URL_THEN_COMPLETE,
                        serverError: (
                            <FormattedMessage
                                id='channel_flow.handleTooShort'
                                defaultMessage='Channel URL must be 2 or more lowercase alphanumeric characters'
                            />
                        )
                    });
                    return;
                }
                if (err.id === 'store.sql_channel.update.exists.app_error') {
                    this.setState({serverError: Utils.localizeMessage('channel_flow.alreadyExist', 'A channel with that URL already exists')});
                    return;
                }
                this.setState({serverError: err.message});
            }
        );
    }
    onModalExited() {
        if (this.doOnModalExited) {
            this.doOnModalExited();
        }
    }
    typeSwitched() {
        if (this.state.channelType === 'P') {
            this.setState({channelType: 'O'});
        } else {
            this.setState({channelType: 'P'});
        }
    }
    urlChangeRequested() {
        this.setState({flowState: SHOW_EDIT_URL});
    }
    urlChangeSubmitted(newURL) {
        if (this.state.flowState === SHOW_EDIT_URL_THEN_COMPLETE) {
            this.setState({channelName: newURL, nameModified: true}, this.doSubmit);
        } else {
            this.setState({flowState: SHOW_NEW_CHANNEL, serverError: null, channelName: newURL, nameModified: true});
        }
    }
    urlChangeDismissed() {
        this.setState({flowState: SHOW_NEW_CHANNEL});
    }
    channelDataChanged(data) {
        this.setState({
            channelDisplayName: data.displayName,
            channelPurpose: data.purpose,
            channelHeader: data.header
        });
        if (!this.state.nameModified) {
            this.setState({channelName: cleanUpUrlable(data.displayName.trim())});
        }
    }
    render() {
        const channelData = {
            name: this.state.channelName,
            displayName: this.state.channelDisplayName,
            purpose: this.state.channelPurpose
        };

        let showChannelModal = false;
        let showGroupModal = false;
        let showChangeURLModal = false;

        let changeURLTitle = '';
        let changeURLSubmitButtonText = '';

        // Only listen to flow state if we are being shown
        if (this.props.show) {
            switch (this.state.flowState) {
            case SHOW_NEW_CHANNEL:
                if (this.state.channelType === 'O') {
                    showChannelModal = true;
                } else {
                    showGroupModal = true;
                }
                break;
            case SHOW_EDIT_URL:
                showChangeURLModal = true;
                changeURLTitle = (
                    <FormattedMessage
                        id='channel_flow.changeUrlTitle'
                        defaultMessage='Change Channel URL'
                    />
                );
                changeURLSubmitButtonText = changeURLTitle;
                break;
            case SHOW_EDIT_URL_THEN_COMPLETE:
                showChangeURLModal = true;
                changeURLTitle = (
                    <FormattedMessage
                        id='channel_flow.set_url_title'
                        defaultMessage='Set Channel URL'
                    />
                );
                changeURLSubmitButtonText = (
                    <FormattedMessage
                        id='channel_flow.create'
                        defaultMessage='Create Channel'
                    />
                );
                break;
            }
        }
        return (
            <span>
                <NewChannelModal
                    show={showChannelModal}
                    channelType={'O'}
                    channelData={channelData}
                    serverError={this.state.serverError}
                    onSubmitChannel={this.doSubmit}
                    onModalDismissed={this.props.onModalDismissed}
                    onModalExited={this.onModalExited}
                    onTypeSwitched={this.typeSwitched}
                    onChangeURLPressed={this.urlChangeRequested}
                    onDataChanged={this.channelDataChanged}
                />
                <NewChannelModal
                    show={showGroupModal}
                    channelType={'P'}
                    channelData={channelData}
                    serverError={this.state.serverError}
                    onSubmitChannel={this.doSubmit}
                    onModalExited={this.onModalExited}
                    onModalDismissed={this.props.onModalDismissed}
                    onTypeSwitched={this.typeSwitched}
                    onChangeURLPressed={this.urlChangeRequested}
                    onDataChanged={this.channelDataChanged}
                />
                <ChangeURLModal
                    show={showChangeURLModal}
                    title={changeURLTitle}
                    submitButtonText={changeURLSubmitButtonText}
                    currentURL={this.state.channelName}
                    serverError={this.state.serverError}
                    onModalSubmit={this.urlChangeSubmitted}
                    onModalDismissed={this.urlChangeDismissed}
                    onModalExited={this.onModalExited}
                />
            </span>
        );
    }
}

NewChannelFlow.defaultProps = {
    show: false,
    channelType: 'O'
};

NewChannelFlow.propTypes = {
    show: PropTypes.bool.isRequired,
    channelType: PropTypes.string.isRequired,
    onModalDismissed: PropTypes.func.isRequired
};

// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';

import NewChannelModal from './new_channel_modal.jsx';
import ChangeURLModal from './change_url_modal.jsx';

import {intlShape, injectIntl, defineMessages} from 'mm-intl';

const SHOW_NEW_CHANNEL = 1;
const SHOW_EDIT_URL = 2;
const SHOW_EDIT_URL_THEN_COMPLETE = 3;
const messages = defineMessages({
    invalidName: {
        id: 'channel_flow.invalidName',
        defaultMessage: 'Invalid Channel Name'
    },
    alreadyExist: {
        id: 'channel_flow.alreadyExist',
        defaultMessage: 'A channel with that URL already exists'
    },
    channel: {
        id: 'channel_flow.channel',
        defaultMessage: 'Channel'
    },
    group: {
        id: 'channel_flow.group',
        defaultMessage: 'Group'
    },
    change: {
        id: 'channel_flow.changeUrlTitle',
        defaultMessage: 'Change {term} URL'
    },
    set: {
        id: 'channel_flow.set_url_title',
        defaultMessage: 'Set {term} URL'
    },
    create: {
        id: 'channel_flow.create',
        defaultMessage: 'Create {term}'
    },
    changeUrlDescription: {
        id: 'channel_flow.changeUrlDescription',
        defaultMessage: 'Some characters are not allowed in URLs and may be removed.'
    }
});

class NewChannelFlow extends React.Component {
    constructor(props) {
        super(props);

        this.doSubmit = this.doSubmit.bind(this);
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
                nameModified: false
            });
        }
    }
    doSubmit() {
        var channel = {};

        const {formatMessage} = this.props.intl;
        channel.display_name = this.state.channelDisplayName;
        if (!channel.display_name) {
            this.setState({serverError: formatMessage(messages.invalidName)});
            return;
        }

        channel.name = this.state.channelName;
        if (channel.name.length < 2) {
            this.setState({flowState: SHOW_EDIT_URL_THEN_COMPLETE});
            return;
        }

        const cu = UserStore.getCurrentUser();
        channel.team_id = cu.team_id;
        channel.purpose = this.state.channelPurpose;
        channel.type = this.state.channelType;

        Client.createChannel(channel,
            (data) => {
                this.props.onModalDismissed();
                AsyncClient.getChannel(data.id);
                Utils.switchChannel(data);
            },
            (err) => {
                if (err.id === 'model.channel.is_valid.2_or_more.app_error') {
                    this.setState({flowState: SHOW_EDIT_URL_THEN_COMPLETE});
                }
                if (err.id === 'store.sql_channel.update.exists.app_error') {
                    this.setState({serverError: formatMessage(messages.alreadyExist)});
                    return;
                }
                this.setState({serverError: err.message});
            }
        );
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
            this.setState({flowState: SHOW_NEW_CHANNEL, serverError: '', channelName: newURL, nameModified: true});
        }
    }
    urlChangeDismissed() {
        this.setState({flowState: SHOW_NEW_CHANNEL});
    }
    channelDataChanged(data) {
        this.setState({
            channelDisplayName: data.displayName,
            channelPurpose: data.purpose
        });
        if (!this.state.nameModified) {
            this.setState({channelName: Utils.cleanUpUrlable(data.displayName.trim())});
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
        let channelTerm = '';

        const {formatMessage} = this.props.intl;

        // Only listen to flow state if we are being shown
        if (this.props.show) {
            switch (this.state.flowState) {
            case SHOW_NEW_CHANNEL:
                if (this.state.channelType === 'O') {
                    showChannelModal = true;
                    channelTerm = formatMessage(messages.channel);
                } else {
                    showGroupModal = true;
                    channelTerm = formatMessage(messages.group);
                }
                break;
            case SHOW_EDIT_URL:
                showChangeURLModal = true;
                changeURLTitle = formatMessage(messages.change, {term: channelTerm});
                changeURLSubmitButtonText = formatMessage(messages.change, {term: channelTerm});
                break;
            case SHOW_EDIT_URL_THEN_COMPLETE:
                showChangeURLModal = true;
                changeURLTitle = formatMessage(messages.set, {term: channelTerm});
                changeURLSubmitButtonText = formatMessage(messages.create, {term: channelTerm});
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
                    onModalDismissed={this.props.onModalDismissed}
                    onTypeSwitched={this.typeSwitched}
                    onChangeURLPressed={this.urlChangeRequested}
                    onDataChanged={this.channelDataChanged}
                />
                <ChangeURLModal
                    show={showChangeURLModal}
                    title={changeURLTitle}
                    description={formatMessage(messages.changeUrlDescription)}
                    urlLabel={channelTerm + ' URL'}
                    submitButtonText={changeURLSubmitButtonText}
                    currentURL={this.state.channelName}
                    serverError={this.state.serverError}
                    onModalSubmit={this.urlChangeSubmitted}
                    onModalDismissed={this.urlChangeDismissed}
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
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    channelType: React.PropTypes.string.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired
};

export default injectIntl(NewChannelFlow);
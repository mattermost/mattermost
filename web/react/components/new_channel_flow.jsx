// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Utils = require('../utils/utils.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var Client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');

var NewChannelModal = require('./new_channel_modal.jsx');
var ChangeURLModal = require('./change_url_modal.jsx');

const SHOW_NEW_CHANNEL = 1;
const SHOW_EDIT_URL = 2;
const SHOW_EDIT_URL_THEN_COMPLETE = 3;

export default class NewChannelFlow extends React.Component {
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
            channelDescription: '',
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
                channelDescription: '',
                nameModified: false
            });
        }
    }
    doSubmit() {
        var channel = {};

        channel.display_name = this.state.channelDisplayName;
        if (!channel.display_name) {
            this.setState({serverError: 'Invalid Channel Name'});
            return;
        }

        channel.name = this.state.channelName;
        if (channel.name.length < 2) {
            this.setState({flowState: SHOW_EDIT_URL_THEN_COMPLETE});
            return;
        }

        const cu = UserStore.getCurrentUser();
        channel.team_id = cu.team_id;
        channel.description = this.state.channelDescription;
        channel.type = this.state.channelType;

        Client.createChannel(channel,
            (data) => {
                this.props.onModalDismissed();
                AsyncClient.getChannel(data.id);
                Utils.switchChannel(data);
            },
            (err) => {
                if (err.message === 'Name must be 2 or more lowercase alphanumeric characters') {
                    this.setState({flowState: SHOW_EDIT_URL_THEN_COMPLETE});
                }
                if (err.message === 'A channel with that handle already exists') {
                    this.setState({serverError: 'A channel with that URL already exists'});
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
            channelDescription: data.description
        });
        if (!this.state.nameModified) {
            this.setState({channelName: Utils.cleanUpUrlable(data.displayName.trim())});
        }
    }
    render() {
        const channelData = {
            name: this.state.channelName,
            displayName: this.state.channelDisplayName,
            description: this.state.channelDescription
        };

        let showChannelModal = false;
        let showGroupModal = false;
        let showChangeURLModal = false;

        let changeURLTitle = '';
        let changeURLSubmitButtonText = '';
        let channelTerm = '';

        // Only listen to flow state if we are being shown
        if (this.props.show) {
            switch (this.state.flowState) {
            case SHOW_NEW_CHANNEL:
                if (this.state.channelType === 'O') {
                    showChannelModal = true;
                    channelTerm = 'Channel';
                } else {
                    showGroupModal = true;
                    channelTerm = 'Group';
                }
                break;
            case SHOW_EDIT_URL:
                showChangeURLModal = true;
                changeURLTitle = 'Change ' + channelTerm + ' URL';
                changeURLSubmitButtonText = 'Change ' + channelTerm + ' URL';
                break;
            case SHOW_EDIT_URL_THEN_COMPLETE:
                showChangeURLModal = true;
                changeURLTitle = 'Set ' + channelTerm + ' URL';
                changeURLSubmitButtonText = 'Create ' + channelTerm;
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
                    description={'Some characters are not allowed in URLs and may be removed.'}
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
    show: React.PropTypes.bool.isRequired,
    channelType: React.PropTypes.string.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired
};

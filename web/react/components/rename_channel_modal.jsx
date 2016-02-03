// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import Constants from '../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    required: {
        id: 'rename_channel.required',
        defaultMessage: 'This field is required'
    },
    maxLength: {
        id: 'rename_channel.maxLength',
        defaultMessage: 'This field must be less than 22 characters'
    },
    lowercase: {
        id: 'rename_channel.lowercase',
        defaultMessage: 'Must be lowercase alphanumeric characters'
    },
    handle: {
        id: 'rename_channel.handle',
        defaultMessage: 'Handle'
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
        defaultMessage: 'lowercase alphanumeric&#39;s only'
    }
});

export default class RenameChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.onNameChange = this.onNameChange.bind(this);
        this.onDisplayNameChange = this.onDisplayNameChange.bind(this);
        this.displayNameKeyUp = this.displayNameKeyUp.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleShow = this.handleShow.bind(this);
        this.handleShown = this.handleShown.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            displayName: '',
            channelName: '',
            channelId: '',
            serverError: '',
            nameError: '',
            displayNameError: '',
            invalid: false
        };
    }
    handleSubmit(e) {
        e.preventDefault();

        if (this.state.channelId.length !== 26) {
            return;
        }

        const channel = ChannelStore.get(this.state.channelId);
        const oldName = channel.name;
        const oldDisplayName = channel.displayName;
        const state = {serverError: ''};
        const {formatMessage} = this.props.intl;

        channel.display_name = this.state.displayName.trim();
        if (!channel.display_name) {
            state.displayNameError = formatMessage(holders.required);
            state.invalid = true;
        } else if (channel.display_name.length > 22) {
            state.displayNameError = formatMessage(holders.maxLength);
            state.invalid = true;
        } else {
            state.displayNameError = '';
        }

        channel.name = this.state.channelName.trim();
        if (!channel.name) {
            state.nameError = formatMessage(holders.required);
            state.invalid = true;
        } else if (channel.name.length > 22) {
            state.nameError = formatMessage(holders.maxLength);
            state.invalid = true;
        } else {
            const cleanedName = Utils.cleanUpUrlable(channel.name);
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

        Client.updateChannel(channel,
            () => {
                $(ReactDOM.findDOMNode(this.refs.modal)).modal('hide');

                AsyncClient.getChannel(channel.id);
                Utils.updateAddressBar(channel.name);

                ReactDOM.findDOMNode(this.refs.displayName).value = '';
                ReactDOM.findDOMNode(this.refs.channelName).value = '';
            },
            (err) => {
                state.serverError = err.message;
                state.invalid = true;
                this.setState(state);
            }
        );
    }
    onNameChange() {
        this.setState({channelName: ReactDOM.findDOMNode(this.refs.channelName).value});
    }
    onDisplayNameChange() {
        this.setState({displayName: ReactDOM.findDOMNode(this.refs.displayName).value});
    }
    displayNameKeyUp() {
        if (this.state.channelName !== Constants.DEFAULT_CHANNEL) {
            const displayName = ReactDOM.findDOMNode(this.refs.displayName).value.trim();
            const channelName = Utils.cleanUpUrlable(displayName);
            ReactDOM.findDOMNode(this.refs.channelName).value = channelName;
            this.setState({channelName: channelName});
        }
    }
    handleClose() {
        this.setState({
            displayName: '',
            channelName: '',
            channelId: '',
            serverError: '',
            nameError: '',
            displayNameError: '',
            invalid: false
        });
    }
    handleShow(e) {
        const button = $(e.relatedTarget);
        this.setState({displayName: button.attr('data-display'), channelName: button.attr('data-name'), channelId: button.attr('data-channelid')});
    }
    handleShown() {
        $('#rename_channel #display_name').focus();
    }
    componentDidMount() {
        $(ReactDOM.findDOMNode(this.refs.modal)).on('show.bs.modal', this.handleShow);
        $(ReactDOM.findDOMNode(this.refs.modal)).on('hidden.bs.modal', this.handleClose);
        $(ReactDOM.findDOMNode(this.refs.modal)).on('shown.bs.modal', this.handleShown);
    }
    componentWillUnmount() {
        $(ReactDOM.findDOMNode(this.refs.modal)).off('hidden.bs.modal', this.handleClose);
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

        let handleInputLabel = formatMessage(holders.handle);
        let handleInputClass = 'form-control';
        let readOnlyHandleInput = false;
        if (this.state.channelName === Constants.DEFAULT_CHANNEL) {
            handleInputLabel += formatMessage(holders.defaultError);
            handleInputClass += ' disabled-input';
            readOnlyHandleInput = true;
        }

        return (
            <div
                className='modal fade'
                ref='modal'
                id='rename_channel'
                tabIndex='-1'
                role='dialog'
                aria-hidden='true'
            >
                <div className='modal-dialog'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                            >
                                <span aria-hidden='true'>{'×'}</span>
                                <span className='sr-only'>
                                    <FormattedMessage
                                        id='rename_channel.close'
                                        defaultMessage='Close'
                                    />
                                </span>
                            </button>
                        <h4 className='modal-title'>
                            <FormattedMessage
                                id='rename_channel.title'
                                defaultMessage='Rename Channel'
                            />
                        </h4>
                        </div>
                        <form role='form'>
                            <div className='modal-body'>
                                <div className={displayNameClass}>
                                    <label className='control-label'>
                                        <FormattedMessage
                                            id='rename_channel.displayName'
                                            defaultMessage='Display Name'
                                        />
                                    </label>
                                    <input
                                        onKeyUp={this.displayNameKeyUp}
                                        onChange={this.onDisplayNameChange}
                                        type='text'
                                        ref='displayName'
                                        id='display_name'
                                        className='form-control'
                                        placeholder={formatMessage(holders.displayNameHolder)}
                                        value={this.state.displayName}
                                        maxLength='64'
                                    />
                                    {displayNameError}
                                </div>
                                <div className={nameClass}>
                                    <label className='control-label'>{handleInputLabel}</label>
                                    <input
                                        onChange={this.onNameChange}
                                        type='text'
                                        className={handleInputClass}
                                        ref='channelName'
                                        placeholder={formatMessage(holders.handleHolder)}
                                        value={this.state.channelName}
                                        maxLength='64'
                                        readOnly={readOnlyHandleInput}
                                    />
                                    {nameError}
                                </div>
                                {serverError}
                            </div>
                            <div className='modal-footer'>
                                <button
                                    type='button'
                                    className='btn btn-default'
                                    data-dismiss='modal'
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
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}

RenameChannelModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(RenameChannelModal);
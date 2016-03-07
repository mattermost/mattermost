// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from '../loading_screen.jsx';

import * as Client from 'utils/client.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

const holders = defineMessages({
    requestTypePost: {
        id: 'user.settings.cmds.request_type_post',
        defaultMessage: 'POST'
    },
    requestTypeGet: {
        id: 'user.settings.cmds.request_type_get',
        defaultMessage: 'GET'
    },
    addDisplayNamePlaceholder: {
        id: 'user.settings.cmds.add_display_name.placeholder',
        defaultMessage: 'Example: "Search patient records"'
    },
    addUsernamePlaceholder: {
        id: 'user.settings.cmds.add_username.placeholder',
        defaultMessage: 'Username'
    },
    addTriggerPlaceholder: {
        id: 'user.settings.cmds.add_trigger.placeholder',
        defaultMessage: 'Command trigger e.g. "hello" not including the slash'
    },
    addAutoCompleteDescPlaceholder: {
        id: 'user.settings.cmds.auto_complete_desc.placeholder',
        defaultMessage: 'Example: "Returns search results for patient records"'
    },
    addAutoCompleteHintPlaceholder: {
        id: 'user.settings.cmds.auto_complete_hint.placeholder',
        defaultMessage: 'Example: [Patient Name]'
    },
    adUrlPlaceholder: {
        id: 'user.settings.cmds.url.placeholder',
        defaultMessage: 'Must start with http:// or https://'
    },
    autocompleteYes: {
        id: 'user.settings.cmds.auto_complete.yes',
        defaultMessage: 'yes'
    },
    autocompleteNo: {
        id: 'user.settings.cmds.auto_complete.no',
        defaultMessage: 'no'
    }
});

import React from 'react';

export default class ManageCommandCmds extends React.Component {
    constructor() {
        super();

        this.getCmds = this.getCmds.bind(this);
        this.addNewCmd = this.addNewCmd.bind(this);
        this.emptyCmd = this.emptyCmd.bind(this);
        this.updateExternalManagement = this.updateExternalManagement.bind(this);
        this.updateTrigger = this.updateTrigger.bind(this);
        this.updateURL = this.updateURL.bind(this);
        this.updateMethod = this.updateMethod.bind(this);
        this.updateUsername = this.updateUsername.bind(this);
        this.updateIconURL = this.updateIconURL.bind(this);
        this.updateDisplayName = this.updateDisplayName.bind(this);
        this.updateAutoComplete = this.updateAutoComplete.bind(this);
        this.updateAutoCompleteDesc = this.updateAutoCompleteDesc.bind(this);
        this.updateAutoCompleteHint = this.updateAutoCompleteHint.bind(this);

        this.state = {cmds: [], cmd: this.emptyCmd(), getCmdsComplete: false};
    }

    static propTypes() {
        return {
            intl: intlShape.isRequired
        };
    }

    emptyCmd() {
        var cmd = {};
        cmd.url = '';
        cmd.trigger = '';
        cmd.method = 'P';
        cmd.username = '';
        cmd.icon_url = '';
        cmd.auto_complete = false;
        cmd.auto_complete_desc = '';
        cmd.auto_complete_hint = '';
        cmd.display_name = '';
        return cmd;
    }

    componentDidMount() {
        this.getCmds();
    }

    addNewCmd(e) {
        e.preventDefault();

        if (this.state.cmd.url === '' || (this.state.cmd.trigger === '' && !this.state.external_management)) {
            return;
        }

        var cmd = this.state.cmd;
        if (cmd.trigger.length !== 0) {
            cmd.trigger = cmd.trigger.trim();
        }
        cmd.url = cmd.url.trim();

        Client.addCommand(
            cmd,
            (data) => {
                let cmds = Object.assign([], this.state.cmds);
                if (!cmds) {
                    cmds = [];
                }
                cmds.push(data);
                this.setState({cmds, addError: null, cmd: this.emptyCmd()});
            },
            (err) => {
                this.setState({addError: err.message});
            }
        );
    }

    removeCmd(id) {
        const data = {};
        data.id = id;

        Client.deleteCommand(
            data,
            () => {
                const cmds = this.state.cmds;
                let index = -1;
                for (let i = 0; i < cmds.length; i++) {
                    if (cmds[i].id === id) {
                        index = i;
                        break;
                    }
                }

                if (index !== -1) {
                    cmds.splice(index, 1);
                }

                this.setState({cmds});
            },
            (err) => {
                this.setState({editError: err.message});
            }
        );
    }

    regenToken(id) {
        const regenData = {};
        regenData.id = id;

        Client.regenCommandToken(
            regenData,
            (data) => {
                const cmds = Object.assign([], this.state.cmds);
                for (let i = 0; i < cmds.length; i++) {
                    if (cmds[i].id === id) {
                        cmds[i] = data;
                        break;
                    }
                }

                this.setState({cmds, editError: null});
            },
            (err) => {
                this.setState({editError: err.message});
            }
        );
    }

    getCmds() {
        Client.listTeamCommands(
            (data) => {
                if (data) {
                    this.setState({cmds: data, getCmdsComplete: true, editError: null});
                }
            },
            (err) => {
                this.setState({editError: err.message});
            }
        );
    }

    updateExternalManagement(e) {
        var cmd = this.state.cmd;
        cmd.external_management = e.target.checked;
        this.setState(cmd);
    }

    updateTrigger(e) {
        var cmd = this.state.cmd;
        cmd.trigger = e.target.value;
        this.setState(cmd);
    }

    updateURL(e) {
        var cmd = this.state.cmd;
        cmd.url = e.target.value;
        this.setState(cmd);
    }

    updateMethod(e) {
        var cmd = this.state.cmd;
        cmd.method = e.target.value;
        this.setState(cmd);
    }

    updateUsername(e) {
        var cmd = this.state.cmd;
        cmd.username = e.target.value;
        this.setState(cmd);
    }

    updateIconURL(e) {
        var cmd = this.state.cmd;
        cmd.icon_url = e.target.value;
        this.setState(cmd);
    }

    updateDisplayName(e) {
        var cmd = this.state.cmd;
        cmd.display_name = e.target.value;
        this.setState(cmd);
    }

    updateAutoComplete(e) {
        var cmd = this.state.cmd;
        cmd.auto_complete = e.target.checked;
        this.setState(cmd);
    }

    updateAutoCompleteDesc(e) {
        var cmd = this.state.cmd;
        cmd.auto_complete_desc = e.target.value;
        this.setState(cmd);
    }

    updateAutoCompleteHint(e) {
        var cmd = this.state.cmd;
        cmd.auto_complete_hint = e.target.value;
        this.setState(cmd);
    }

    render() {
        let addError;
        if (this.state.addError) {
            addError = <label className='has-error'>{this.state.addError}</label>;
        }

        let editError;
        if (this.state.editError) {
            addError = <label className='has-error'>{this.state.editError}</label>;
        }

        const cmds = [];
        this.state.cmds.forEach((cmd) => {
            let triggerDiv;
            if (cmd.trigger && cmd.trigger.length !== 0) {
                triggerDiv = (
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.trigger'
                                defaultMessage='Command Trigger Word: '
                            />
                        </strong>{cmd.trigger}
                    </div>
                );
            }

            let slashCommandAutocompleteDiv;
            if (Utils.isFeatureEnabled(PreReleaseFeatures.SLASHCMD_AUTOCMP)) {
                slashCommandAutocompleteDiv = (
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.external_management'
                                defaultMessage='External management: '
                            />
                        </strong><span className='word-break--all'>{cmd.external_management ? this.props.intl.formatMessage(holders.autocompleteYes) : this.props.intl.formatMessage(holders.autocompleteNo)}</span>
                    </div>
                );
            }

            cmds.push(
                <div
                    key={cmd.id}
                    className='webhook__item webcmd__item'
                >
                    {slashCommandAutocompleteDiv}
                    {triggerDiv}
                    <div className='padding-top x2 webcmd__url'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.url'
                                defaultMessage='Request URL: '
                            />
                        </strong><span className='word-break--all'>{cmd.url}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.request_type'
                                defaultMessage='Request Method: '
                            />
                        </strong>
                        <span className='word-break--all'>
                            {
                                cmd.method === 'P' ?
                                <FormattedMessage
                                    id='user.settings.cmds.request_type_post'
                                    defaultMessage='POST'
                                /> :
                                <FormattedMessage
                                    id='user.settings.cmds.request_type_get'
                                    defaultMessage='GET'
                                />
                            }
                        </span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.username'
                                defaultMessage='Response Username: '
                            />
                        </strong><span className='word-break--all'>{cmd.username}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.icon_url'
                                defaultMessage='Response Icon: '
                            />
                        </strong><span className='word-break--all'>{cmd.icon_url}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete'
                                defaultMessage='Autocomplete: '
                            />
                        </strong><span className='word-break--all'>{cmd.auto_complete ? this.props.intl.formatMessage(holders.autocompleteYes) : this.props.intl.formatMessage(holders.autocompleteNo)}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_hint'
                                defaultMessage='Autocomplete Hint: '
                            />
                        </strong><span className='word-break--all'>{cmd.auto_complete_hint}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_desc'
                                defaultMessage='Autocomplete Description: '
                            />
                        </strong><span className='word-break--all'>{cmd.auto_complete_desc}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.display_name'
                                defaultMessage='Descriptive Label: '
                            />
                        </strong><span className='word-break--all'>{cmd.display_name}</span>
                    </div>
                    <div className='padding-top'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.token'
                                defaultMessage='Token: '
                            />
                        </strong>{cmd.token}
                    </div>
                    <div className='padding-top'>
                        <a
                            className='text-danger'
                            href='#'
                            onClick={this.regenToken.bind(this, cmd.id)}
                        >
                            <FormattedMessage
                                id='user.settings.cmds.regen'
                                defaultMessage='Regen Token'
                            />
                        </a>
                        <a
                            className='webhook__remove webcmd__remove'
                            href='#'
                            onClick={this.removeCmd.bind(this, cmd.id)}
                        >
                            <span aria-hidden='true'>{'×'}</span>
                        </a>
                    </div>
                    <div className='padding-top x2 divider-light'></div>
                </div>
            );
        });

        let displayCmds;
        if (!this.state.getCmdsComplete) {
            displayCmds = <LoadingScreen/>;
        } else if (cmds.length > 0) {
            displayCmds = cmds;
        } else {
            displayCmds = (
                <div className='padding-top x2'>
                    <FormattedMessage
                        id='user.settings.cmds.none'
                        defaultMessage='None'
                    />
                </div>
            );
        }

        const existingCmds = (
            <div className='webhooks__container webcmds__container'>
                <label className='control-label padding-top x2'>
                    <FormattedMessage
                        id='user.settings.cmds.existing'
                        defaultMessage='Existing commands'
                    />
                </label>
                <div className='padding-top divider-light'></div>
                <div className='webhooks__list webcmds__list'>
                    {displayCmds}
                </div>
            </div>
        );

        const disableButton = this.state.cmd.url === '' || (this.state.cmd.trigger === '' && !this.state.external_management);

        let slashCommandAutocompleteCheckbox;
        if (Utils.isFeatureEnabled(PreReleaseFeatures.SLASHCMD_AUTOCMP)) {
            slashCommandAutocompleteCheckbox = (
                <div className='padding-top x2'>
                    <label className='control-label'>
                        <FormattedMessage
                            id='user.settings.cmds.external_management'
                            defaultMessage='External management: '
                        />
                    </label>
                    <div className='padding-top'>
                        <div className='checkbox'>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={this.state.cmd.external_management}
                                    onChange={this.updateExternalManagement}
                                />
                                <FormattedMessage
                                    id='user.settings.cmds.slashCmd_autocmp'
                                    defaultMessage='Enable external application to offer autocomplete'
                                />
                            </label>
                        </div>
                    </div>
                </div>

            );
        }

        return (
            <div key='addCommandCmd'>
                <FormattedHTMLMessage
                    id='user.settings.cmds.add_desc'
                    defaultMessage='Create slash commands to send events to external integrations and receive a response. For example typing `/patient Joe Smith` could bring back search results from your internal health records management system for the name “Joe Smith”.  Please see <a href="http://docs.mattermost.com/developer/slash-commands.html">Slash commands documentation</a>  for detailed instructions. View all slash commands configured on this team below.'
                />
                <div><label className='control-label padding-top x2'>
                    <FormattedMessage
                        id='user.settings.cmds.add_new'
                        defaultMessage='Add a new command'
                    />
                </label></div>
                <div className='padding-top divider-light'></div>
                <div className='padding-top'>

                    <div className='padding-top x2'>
                        {slashCommandAutocompleteCheckbox}
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.trigger'
                                defaultMessage='Command Trigger Word: '
                            />
                        </label>
                        <div className='padding-top'>
                            <input
                                ref='trigger'
                                className='form-control'
                                value={this.state.cmd.trigger}
                                onChange={this.updateTrigger}
                                placeholder={this.props.intl.formatMessage(holders.addTriggerPlaceholder)}
                            />
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.trigger_desc'
                                defaultMessage='Examples: /patient, /client, /employee Reserved: /echo, /join, /logout, /me, /shrug'
                            />
                        </div>
                    </div>

                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.url'
                                defaultMessage='Request URL: '
                            />
                        </label>
                        <div className='padding-top'>
                        <input
                            ref='URL'
                            className='form-control'
                            value={this.state.cmd.url}
                            rows={1}
                            onChange={this.updateURL}
                            placeholder={this.props.intl.formatMessage(holders.adUrlPlaceholder)}
                        />
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.url_desc'
                                defaultMessage='The callback URL to receive the HTTP POST or GET event request when the slash command is run.'
                            />
                        </div>
                    </div>

                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.request_type'
                                defaultMessage='Request Method: '
                            />
                        </label>
                        <div className='padding-top'>
                            <select
                                ref='method'
                                className='form-control'
                                value={this.state.cmd.method}
                                onChange={this.updateMethod}
                            >
                                <option value='P'>
                                    {this.props.intl.formatMessage(holders.requestTypePost)}
                                </option>
                                <option value='G'>
                                    {this.props.intl.formatMessage(holders.requestTypeGet)}
                                </option>
                            </select>
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.request_type_desc'
                                defaultMessage='The type of command request issued to the Request URL.'
                            />
                        </div>
                    </div>

                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.username'
                                defaultMessage='Response Username: '
                            />
                        </label>
                        <div className='padding-top'>
                            <input
                                ref='username'
                                className='form-control'
                                value={this.state.cmd.username}
                                onChange={this.updateUsername}
                                placeholder={this.props.intl.formatMessage(holders.addUsernamePlaceholder)}
                            />
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.username_desc'
                                defaultMessage='Choose a username override for responses for this slash command. Usernames can consist of up to 22 characters consisting of lowercase letters, numbers and they symbols "-", "_", and "." .'
                            />
                        </div>
                    </div>

                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.icon_url'
                                defaultMessage='Response Icon: '
                            />
                        </label>
                        <div className='padding-top'>
                            <input
                                ref='iconURL'
                                className='form-control'
                                value={this.state.cmd.icon_url}
                                onChange={this.updateIconURL}
                                placeholder='https://www.example.com/myicon.png'
                            />
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.icon_url_desc'
                                defaultMessage='Choose a profile picture override for the post responses to this slash command. Enter the URL of a .png or .jpg file at least 128 pixels by 128 pixels.'
                            />
                        </div>
                    </div>

                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete'
                                defaultMessage='Autocomplete: '
                            />
                        </label>
                        <div className='padding-top'>
                            <div className='checkbox'>
                                <label>
                                    <input
                                        type='checkbox'
                                        checked={this.state.cmd.auto_complete}
                                        onChange={this.updateAutoComplete}
                                    />
                                    <FormattedMessage
                                        id='user.settings.cmds.auto_complete_help'
                                        defaultMessage=' Show this command in the autocomplete list.'
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_hint'
                                defaultMessage='Autocomplete Hint: '
                            />
                        </label>
                        <div className='padding-top'>
                            <input
                                ref='autoCompleteHint'
                                className='form-control'
                                value={this.state.cmd.auto_complete_hint}
                                onChange={this.updateAutoCompleteHint}
                                placeholder={this.props.intl.formatMessage(holders.addAutoCompleteHintPlaceholder)}
                            />
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_hint_desc'
                                defaultMessage='Optional hint in the autocomplete list about parameters needed for command.'
                            />
                        </div>
                    </div>

                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_desc'
                                defaultMessage='Autocomplete Description: '
                            />
                        </label>
                        <div className='padding-top'>
                            <input
                                ref='autoCompleteDesc'
                                className='form-control'
                                value={this.state.cmd.auto_complete_desc}
                                onChange={this.updateAutoCompleteDesc}
                                placeholder={this.props.intl.formatMessage(holders.addAutoCompleteDescPlaceholder)}
                            />
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_desc_desc'
                                defaultMessage='Optional short description of slash command for the autocomplete list.'
                            />
                        </div>
                    </div>

                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.display_name'
                                defaultMessage='Descriptive Label: '
                            />
                        </label>
                        <div className='padding-top'>
                            <input
                                ref='displayName'
                                className='form-control'
                                value={this.state.cmd.display_name}
                                onChange={this.updateDisplayName}
                                placeholder={this.props.intl.formatMessage(holders.addDisplayNamePlaceholder)}
                            />
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.cmd_display_name'
                                defaultMessage='Brief description of slash command to show in listings.'
                            />
                        </div>
                        {addError}
                    </div>

                    <div className='padding-top x2 padding-bottom'>
                        <a
                            className={'btn btn-sm btn-primary'}
                            href='#'
                            disabled={disableButton}
                            onClick={this.addNewCmd}
                        >
                            <FormattedMessage
                                id='user.settings.cmds.add'
                                defaultMessage='Add'
                            />
                        </a>
                    </div>
                </div>
                {existingCmds}
                {editError}
            </div>
        );
    }
}

export default injectIntl(ManageCommandCmds);

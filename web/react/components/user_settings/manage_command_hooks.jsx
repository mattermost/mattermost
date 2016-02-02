// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from '../loading_screen.jsx';

import * as Client from '../../utils/client.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

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
        defaultMessage: 'Display Name'
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
        defaultMessage: 'A short description of what this commands does.'
    },
    addAutoCompleteHintPlaceholder: {
        id: 'user.settings.cmds.auto_complete_hint.placeholder',
        defaultMessage: '[zipcode]'
    },
    adUrlPlaceholder: {
        id: 'user.settings.cmds.url.placeholder',
        defaultMessage: 'Must start with http:// or https://'
    }
});

export default class ManageCommandCmds extends React.Component {
    constructor() {
        super();

        this.getCmds = this.getCmds.bind(this);
        this.addNewCmd = this.addNewCmd.bind(this);
        this.emptyCmd = this.emptyCmd.bind(this);
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

        if (this.state.cmd.trigger === '' || this.state.cmd.url === '') {
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
                    <div className='padding-top'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.trigger'
                                defaultMessage='Trigger: '
                            />
                        </strong>{cmd.trigger}
                    </div>
                );
            }

            cmds.push(
                <div
                    key={cmd.id}
                    className='webcmd__item'
                >
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.display_name'
                                defaultMessage='Display Name: '
                            />
                        </strong><span className='word-break--all'>{cmd.display_name}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.username'
                                defaultMessage='Username: '
                            />
                        </strong><span className='word-break--all'>{cmd.username}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.icon_url'
                                defaultMessage='Icon URL: '
                            />
                        </strong><span className='word-break--all'>{cmd.icon_url}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete'
                                defaultMessage='Auto Complete: '
                            />
                        </strong><span className='word-break--all'>{cmd.auto_complete ? 'yes' : 'no'}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_desc'
                                defaultMessage='Auto Complete Description: '
                            />
                        </strong><span className='word-break--all'>{cmd.auto_complete_desc}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_hint'
                                defaultMessage='Auto Complete Hint: '
                            />
                        </strong><span className='word-break--all'>{cmd.auto_complete_hint}</span>
                    </div>
                    <div className='padding-top x2'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.request_type'
                                defaultMessage='Request Type: '
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
                    <div className='padding-top x2 webcmd__url'>
                        <strong>
                            <FormattedMessage
                                id='user.settings.cmds.url'
                                defaultMessage='URL: '
                            />
                        </strong><span className='word-break--all'>{cmd.url}</span>
                    </div>
                    {triggerDiv}
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
                            className='webcmd__remove'
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
            <div className='webcmds__container'>
                <label className='control-label padding-top x2'>
                    <FormattedMessage
                        id='user.settings.cmds.existing'
                        defaultMessage='Existing commands'
                    />
                </label>
                <div className='padding-top divider-light'></div>
                <div className='webcmds__list'>
                    {displayCmds}
                </div>
            </div>
        );

        const disableButton = this.state.cmd.trigger === '' || this.state.cmd.url === '';

        return (
            <div key='addCommandCmd'>
                <FormattedHTMLMessage
                    id='user.settings.cmds.add_desc'
                    defaultMessage='Create commands to send message events to an external integration. Please see <a href="http://mattermost.org/commands">http://mattermost.org/commands</a>  to learn more.'
                />
                <div><label className='control-label padding-top x2'>{'Add a new command'}</label></div>
                <div className='padding-top divider-light'></div>
                <div className='padding-top'>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.display_name'
                                defaultMessage='Display Name: '
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
                        <div className='padding-top'>{'Command display name.'}</div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.username'
                                defaultMessage='Username: '
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
                                defaultMessage='The username to use when overriding the post.'
                            />
                        </div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.icon_url'
                                defaultMessage='Icon URL: '
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
                                defaultMessage='URL to an icon'
                            />
                        </div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.trigger'
                                defaultMessage='Trigger: '
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
                                defaultMessage='Word to trigger on'
                            />
                        {''}</div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete'
                                defaultMessage='Auto Complete: '
                            />
                        </label>
                        <div className='padding-top'>
                            <label>
                                <input
                                    type='checkbox'
                                    checked={this.state.cmd.auto_complete}
                                    onChange={this.updateAutoComplete}
                                />
                                <FormattedMessage
                                    id='user.settings.cmds.auto_complete_desc_desc'
                                    defaultMessage='A short description of what this commands does'
                                />
                            </label>
                        </div>
                        <div className='padding-top'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_help'
                                defaultMessage='Show this command in autocomplete list.'
                            />
                        </div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_desc'
                                defaultMessage='Auto Complete Description: '
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
                                defaultMessage='A short description of what this commands does'
                            />
                        </div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.auto_complete_hint'
                                defaultMessage='Auto Complete Hint: '
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
                                defaultMessage='List parameters to be passed to the command.'
                            />
                        </div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.request_type'
                                defaultMessage='Request Type: '
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
                                defaultMessage='Command request type issued to the callback URL.'
                            />
                        </div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='user.settings.cmds.url'
                                defaultMessage='URL: '
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
                                defaultMessage='URL that will receive the HTTP POST or GET event'
                            />
                        </div>
                        {addError}
                    </div>
                    <div className='padding-top padding-bottom'>
                        <a
                            className={'btn btn-sm btn-primary'}
                            href='#'
                            disabled={disableButton}
                            onClick={this.addNewCmd}
                        >
                            {'Add'}
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

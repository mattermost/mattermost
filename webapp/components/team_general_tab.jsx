// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import SettingItemMin from './setting_item_min.jsx';
import SettingItemMax from './setting_item_max.jsx';

import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';
import TeamStore from 'stores/team_store.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const holders = defineMessages({
    dirDisabled: {
        id: 'general_tab.dirDisabled',
        defaultMessage: 'Team Directory has been disabled.  Please ask a System Admin to enable the Team Directory in the System Console team settings.'
    },
    required: {
        id: 'general_tab.required',
        defaultMessage: 'This field is required'
    },
    chooseName: {
        id: 'general_tab.chooseName',
        defaultMessage: 'Please choose a new name for your team'
    },
    includeDirTitle: {
        id: 'general_tab.includeDirTitle',
        defaultMessage: 'Include this team in the Team Directory'
    },
    yes: {
        id: 'general_tab.yes',
        defaultMessage: 'Yes'
    },
    no: {
        id: 'general_tab.no',
        defaultMessage: 'No'
    },
    dirOff: {
        id: 'general_tab.dirOff',
        defaultMessage: 'Team directory is turned off for this system.'
    },
    openInviteTitle: {
        id: 'general_tab.openInviteTitle',
        defaultMessage: 'Allow any user with an account on this server to join this team'
    },
    codeTitle: {
        id: 'general_tab.codeTitle',
        defaultMessage: 'Invite Code'
    },
    codeDesc: {
        id: 'general_tab.codeDesc',
        defaultMessage: "Click 'Edit' to regenerate Invite Code."
    },
    teamNameInfo: {
        id: 'general_tab.teamNameInfo',
        defaultMessage: 'Set the name of the team as it appears on your sign-in screen and at the top of the left-hand sidebar.'
    }
});

import React from 'react';

class GeneralTab extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);
        this.handleNameSubmit = this.handleNameSubmit.bind(this);
        this.handleInviteIdSubmit = this.handleInviteIdSubmit.bind(this);
        this.handleOpenInviteSubmit = this.handleOpenInviteSubmit.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.onUpdateNameSection = this.onUpdateNameSection.bind(this);
        this.updateName = this.updateName.bind(this);
        this.onUpdateInviteIdSection = this.onUpdateInviteIdSection.bind(this);
        this.updateInviteId = this.updateInviteId.bind(this);
        this.onUpdateOpenInviteSection = this.onUpdateOpenInviteSection.bind(this);
        this.handleOpenInviteRadio = this.handleOpenInviteRadio.bind(this);
        this.handleGenerateInviteId = this.handleGenerateInviteId.bind(this);

        this.state = this.setupInitialState(props);
    }

    updateSection(section) {
        $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
        this.setState(this.setupInitialState(this.props));
        this.props.updateSection(section);
    }

    setupInitialState(props) {
        const team = props.team;

        return {
            name: team.display_name,
            invite_id: team.invite_id,
            allow_open_invite: team.allow_open_invite,
            serverError: '',
            clientError: ''
        };
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            name: nextProps.team.display_name,
            invite_id: nextProps.team.invite_id,
            allow_open_invite: nextProps.team.allow_open_invite
        });
    }

    handleGenerateInviteId(e) {
        e.preventDefault();

        var newId = '';
        for (var i = 0; i < 32; i++) {
            newId += Math.floor(Math.random() * 16).toString(16);
        }

        this.setState({invite_id: newId});
    }

    handleOpenInviteRadio(openInvite) {
        this.setState({allow_open_invite: openInvite});
    }

    handleOpenInviteSubmit(e) {
        e.preventDefault();

        var state = {serverError: '', clientError: ''};

        var data = this.props.team;
        data.allow_open_invite = this.state.allow_open_invite;
        Client.updateTeam(data,
            (team) => {
                TeamStore.saveTeam(team);
                TeamStore.emitChange();
                this.updateSection('');
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }

    handleNameSubmit(e) {
        e.preventDefault();

        var state = {serverError: '', clientError: ''};
        let valid = true;

        const {formatMessage} = this.props.intl;
        const name = this.state.name.trim();
        if (!name) {
            state.clientError = formatMessage(holders.required);
            valid = false;
        } else if (name === this.props.team.display_name) {
            state.clientError = formatMessage(holders.chooseName);
            valid = false;
        } else {
            state.clientError = '';
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        var data = this.props.team;
        data.display_name = this.state.name;
        Client.updateTeam(data,
            (team) => {
                TeamStore.saveTeam(team);
                TeamStore.emitChange();
                this.updateSection('');
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }

    handleInviteIdSubmit(e) {
        e.preventDefault();

        var state = {serverError: '', clientError: ''};
        let valid = true;

        const inviteId = this.state.invite_id.trim();
        if (inviteId) {
            state.clientError = '';
        } else {
            state.clientError = this.props.intl.fromatMessage(holders.required);
            valid = false;
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        var data = this.props.team;
        data.invite_id = this.state.invite_id;
        Client.updateTeam(data,
            (team) => {
                TeamStore.saveTeam(team);
                TeamStore.emitChange();
                this.updateSection('');
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }

    handleClose() {
        this.updateSection('');
    }

    componentDidMount() {
        $('#team_settings').on('hidden.bs.modal', this.handleClose);
    }

    componentWillUnmount() {
        $('#team_settings').off('hidden.bs.modal', this.handleClose);
    }

    onUpdateNameSection(e) {
        e.preventDefault();
        if (this.props.activeSection === 'name') {
            this.updateSection('');
        } else {
            this.updateSection('name');
        }
    }

    onUpdateInviteIdSection(e) {
        e.preventDefault();
        if (this.props.activeSection === 'invite_id') {
            this.updateSection('');
        } else {
            this.updateSection('invite_id');
        }
    }

    onUpdateOpenInviteSection(e) {
        e.preventDefault();
        if (this.props.activeSection === 'open_invite') {
            this.updateSection('');
        } else {
            this.updateSection('open_invite');
        }
    }

    updateName(e) {
        this.setState({name: e.target.value});
    }

    updateInviteId(e) {
        this.setState({invite_id: e.target.value});
    }

    render() {
        let clientError = null;
        let serverError = null;
        if (this.state.clientError) {
            clientError = this.state.clientError;
        }
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        const {formatMessage} = this.props.intl;

        let openInviteSection;
        if (this.props.activeSection === 'open_invite') {
            const inputs = [
                <div key='userOpenInviteOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                name='userOpenInviteOptions'
                                type='radio'
                                defaultChecked={this.state.allow_open_invite}
                                onChange={this.handleOpenInviteRadio.bind(this, true)}
                            />
                            <FormattedMessage
                                id='general_tab.yes'
                                defaultMessage='Yes'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                name='userOpenInviteOptions'
                                type='radio'
                                defaultChecked={!this.state.allow_open_invite}
                                onChange={this.handleOpenInviteRadio.bind(this, false)}
                            />
                            <FormattedMessage
                                id='general_tab.no'
                                defaultMessage='No'
                            />
                        </label>
                        <br/>
                    </div>
                    <div>
                        <br/>
                        <FormattedMessage
                            id='general_tab.openInviteDesc'
                            defaultMessage='When allowed, a link to this team will be included on the landing page allowing anyone with an account to join this team.'
                        />
                    </div>
                </div>
            ];

            openInviteSection = (
                <SettingItemMax
                    title={formatMessage(holders.openInviteTitle)}
                    inputs={inputs}
                    submit={this.handleOpenInviteSubmit}
                    server_error={serverError}
                    updateSection={this.onUpdateOpenInviteSection}
                />
            );
        } else {
            let describe = '';
            if (this.state.allow_open_invite === true) {
                describe = formatMessage(holders.yes);
            } else {
                describe = formatMessage(holders.no);
            }

            openInviteSection = (
                <SettingItemMin
                    title={formatMessage(holders.openInviteTitle)}
                    describe={describe}
                    updateSection={this.onUpdateOpenInviteSection}
                />
            );
        }

        let inviteSection;

        if (this.props.activeSection === 'invite_id') {
            const inputs = [];

            inputs.push(
                <div key='teamInviteSetting'>
                    <div className='row'>
                        <label className='col-sm-5 control-label visible-xs-block'>
                        </label>
                        <div className='col-sm-12'>
                            <input
                                className='form-control'
                                type='text'
                                onChange={this.updateInviteId}
                                value={this.state.invite_id}
                                maxLength='32'
                            />
                            <div className='padding-top x2'>
                                <a
                                    href='#'
                                    onClick={this.handleGenerateInviteId}
                                >
                                    <FormattedMessage
                                        id='general_tab.regenerate'
                                        defaultMessage='Regenerate'
                                    />
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className='setting-list__hint'>
                        <FormattedHTMLMessage
                            id='general_tab.codeLongDesc'
                            defaultMessage='The Invite Code is used as part of the URL in the team invitation link created by <strong>Get Team Invite Link</strong> in the main menu. Regenerating creates a new team invitation link and invalidates the previous link.'
                        />
                    </div>
                </div>
            );

            inviteSection = (
                <SettingItemMax
                    title={formatMessage(holders.codeTitle)}
                    inputs={inputs}
                    submit={this.handleInviteIdSubmit}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={this.onUpdateInviteIdSection}
                />
            );
        } else {
            inviteSection = (
                <SettingItemMin
                    title={formatMessage(holders.codeTitle)}
                    describe={formatMessage(holders.codeDesc)}
                    updateSection={this.onUpdateInviteIdSection}
                />
            );
        }

        let nameSection;

        if (this.props.activeSection === 'name') {
            const inputs = [];

            let teamNameLabel = (
                <FormattedMessage
                    id='general_tab.teamName'
                    defaultMessage='Team Name'
                />
            );
            if (Utils.isMobile()) {
                teamNameLabel = '';
            }

            inputs.push(
                <div
                    key='teamNameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{teamNameLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            className='form-control'
                            type='text'
                            maxLength='22'
                            onChange={this.updateName}
                            value={this.state.name}
                        />
                    </div>
                </div>
            );

            const nameExtraInfo = <span>{formatMessage(holders.teamNameInfo)}</span>;

            nameSection = (
                <SettingItemMax
                    title={formatMessage({id: 'general_tab.teamName'})}
                    inputs={inputs}
                    submit={this.handleNameSubmit}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={this.onUpdateNameSection}
                    extraInfo={nameExtraInfo}
                />
            );
        } else {
            var describe = this.state.name;

            nameSection = (
                <SettingItemMin
                    title={formatMessage({id: 'general_tab.teamName'})}
                    describe={describe}
                    updateSection={this.onUpdateNameSection}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        <span aria-hidden='true'>
                            {'×'}
                        </span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <div className='modal-back'>
                            <i className='fa fa-angle-left'></i>
                        </div>
                        <FormattedMessage
                            id='general_tab.title'
                            defaultMessage='General Settings'
                        />
                    </h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='general_tab.title'
                            defaultMessage='General Settings'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    {nameSection}
                    <div className='divider-light'/>
                    {openInviteSection}
                    <div className='divider-light'/>
                    {inviteSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

GeneralTab.propTypes = {
    intl: intlShape.isRequired,
    updateSection: React.PropTypes.func.isRequired,
    team: React.PropTypes.object.isRequired,
    activeSection: React.PropTypes.string.isRequired
};

export default injectIntl(GeneralTab);

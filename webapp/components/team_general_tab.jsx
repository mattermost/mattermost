// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import SettingItemMin from './setting_item_min.jsx';
import SettingItemMax from './setting_item_max.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';
import {updateTeam} from 'actions/team_actions.jsx';

import PropTypes from 'prop-types';

import React from 'react';

class GeneralTab extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);
        this.handleNameSubmit = this.handleNameSubmit.bind(this);
        this.handleInviteIdSubmit = this.handleInviteIdSubmit.bind(this);
        this.handleOpenInviteSubmit = this.handleOpenInviteSubmit.bind(this);
        this.handleDescriptionSubmit = this.handleDescriptionSubmit.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.onUpdateNameSection = this.onUpdateNameSection.bind(this);
        this.updateName = this.updateName.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.onUpdateDescriptionSection = this.onUpdateDescriptionSection.bind(this);
        this.onUpdateInviteIdSection = this.onUpdateInviteIdSection.bind(this);
        this.updateInviteId = this.updateInviteId.bind(this);
        this.onUpdateOpenInviteSection = this.onUpdateOpenInviteSection.bind(this);
        this.handleOpenInviteRadio = this.handleOpenInviteRadio.bind(this);
        this.handleGenerateInviteId = this.handleGenerateInviteId.bind(this);

        this.state = this.setupInitialState(props);
    }

    updateSection(section) {
        if ($('.section-max').length) {
            $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
        }
        this.setState(this.setupInitialState(this.props));
        this.props.updateSection(section);
    }

    setupInitialState(props) {
        const team = props.team;

        return {
            name: team.display_name,
            invite_id: team.invite_id,
            allow_open_invite: team.allow_open_invite,
            description: team.description,
            serverError: '',
            clientError: ''
        };
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            name: nextProps.team.display_name,
            description: nextProps.team.description,
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

        var data = {...this.props.team};
        data.allow_open_invite = this.state.allow_open_invite;
        updateTeam(data,
            () => {
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

        const name = this.state.name.trim();
        if (name) {
            state.clientError = '';
        } else {
            state.clientError = Utils.localizeMessage('general_tab.required', 'This field is required');
            valid = false;
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        var data = {...this.props.team};
        data.display_name = this.state.name;
        updateTeam(data,
            () => {
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
            state.clientError = Utils.localizeMessage('general_tab.required', 'This field is required');
            valid = false;
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        var data = {...this.props.team};
        data.invite_id = this.state.invite_id;
        updateTeam(data,
            () => {
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

    handleDescriptionSubmit(e) {
        e.preventDefault();

        var state = {serverError: '', clientError: ''};
        let valid = true;

        const description = this.state.description.trim();
        if (description === this.props.team.description) {
            state.clientError = Utils.localizeMessage('general_tab.chooseDescription', 'Please choose a new description for your team');
            valid = false;
        } else {
            state.clientError = '';
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        var data = {...this.props.team};
        data.description = this.state.description;
        updateTeam(data,
            () => {
                this.updateSection('');
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
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

    onUpdateDescriptionSection(e) {
        e.preventDefault();
        if (this.props.activeSection === 'description') {
            this.updateSection('');
        } else {
            this.updateSection('description');
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

    updateDescription(e) {
        this.setState({description: e.target.value});
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

        let openInviteSection;
        if (this.props.activeSection === 'open_invite') {
            const inputs = [
                <div key='userOpenInviteOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                id='teamOpenInvite'
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
                                id='teamOpenInviteNo'
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
                    title={Utils.localizeMessage('general_tab.openInviteTitle', 'Allow any user with an account on this server to join this team')}
                    inputs={inputs}
                    submit={this.handleOpenInviteSubmit}
                    server_error={serverError}
                    updateSection={this.onUpdateOpenInviteSection}
                />
            );
        } else {
            let describe = '';
            if (this.state.allow_open_invite === true) {
                describe = Utils.localizeMessage('general_tab.yes', 'Yes');
            } else {
                describe = Utils.localizeMessage('general_tab.no', 'No');
            }

            openInviteSection = (
                <SettingItemMin
                    title={Utils.localizeMessage('general_tab.openInviteTitle', 'Allow any user with an account on this server to join this team')}
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
                        <label className='col-sm-5 control-label visible-xs-block'/>
                        <div className='col-sm-12'>
                            <input
                                id='teamInviteId'
                                className='form-control'
                                type='text'
                                onChange={this.updateInviteId}
                                value={this.state.invite_id}
                                maxLength='32'
                            />
                            <div className='padding-top x2'>
                                <a
                                    id='teamInviteIdRegenerate'
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
                        <FormattedMessage
                            id='general_tab.codeLongDesc'
                            defaultMessage='The Invite Code is used as part of the URL in the team invitation link created by {getTeamInviteLink} in the main menu. Regenerating creates a new team invitation link and invalidates the previous link.'
                            values={{
                                getTeamInviteLink: (
                                    <strong>
                                        <FormattedMessage
                                            id='general_tab.getTeamInviteLink'
                                            defaultMessage='Get Team Invite Link'
                                        />
                                    </strong>
                                )
                            }}
                        />
                    </div>
                </div>
            );

            inviteSection = (
                <SettingItemMax
                    title={Utils.localizeMessage('general_tab.codeTitle', 'Invite Code')}
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
                    title={Utils.localizeMessage('general_tab.codeTitle', 'Invite Code')}
                    describe={Utils.localizeMessage('general_tab.codeDesc', "Click 'Edit' to regenerate Invite Code.")}
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
                            id='teamName'
                            className='form-control'
                            type='text'
                            maxLength={Constants.MAX_TEAMNAME_LENGTH.toString()}
                            onChange={this.updateName}
                            value={this.state.name}
                        />
                    </div>
                </div>
            );

            const nameExtraInfo = <span>{Utils.localizeMessage('general_tab.teamNameInfo', 'Set the name of the team as it appears on your sign-in screen and at the top of the left-hand sidebar.')}</span>;

            nameSection = (
                <SettingItemMax
                    title={Utils.localizeMessage('general_tab.teamName', 'Team Name')}
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
                    title={Utils.localizeMessage('general_tab.teamName', 'Team Name')}
                    describe={describe}
                    updateSection={this.onUpdateNameSection}
                />
            );
        }

        let descriptionSection;

        if (this.props.activeSection === 'description') {
            const inputs = [];

            let teamDescriptionLabel = (
                <FormattedMessage
                    id='general_tab.teamDescription'
                    defaultMessage='Team Description'
                />
            );
            if (Utils.isMobile()) {
                teamDescriptionLabel = '';
            }

            inputs.push(
                <div
                    key='teamDescriptionSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{teamDescriptionLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            id='teamDescription'
                            className='form-control'
                            type='text'
                            maxLength={Constants.MAX_TEAMDESCRIPTION_LENGTH.toString()}
                            onChange={this.updateDescription}
                            value={this.state.description}
                        />
                    </div>
                </div>
            );

            const descriptionExtraInfo = <span>{Utils.localizeMessage('general_tab.teamDescriptionInfo', 'Team description provides additional information to help users select the right team. Maximum of 50 characters.')}</span>;

            descriptionSection = (
                <SettingItemMax
                    title={Utils.localizeMessage('general_tab.teamDescription', 'Team Description')}
                    inputs={inputs}
                    submit={this.handleDescriptionSubmit}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={this.onUpdateDescriptionSection}
                    extraInfo={descriptionExtraInfo}
                />
            );
        } else {
            let describemsg = '';
            if (this.state.description) {
                describemsg = this.state.description;
            } else {
                describemsg = (
                    <FormattedMessage
                        id='general_tab.emptyDescription'
                        defaultMessage="Click 'Edit' to add a team description."
                    />
                );
            }

            descriptionSection = (
                <SettingItemMin
                    title={Utils.localizeMessage('general_tab.teamDescription', 'Team Description')}
                    describe={describemsg}
                    updateSection={this.onUpdateDescriptionSection}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        id='closeButton'
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
                            <i className='fa fa-angle-left'/>
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
                    {descriptionSection}
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
    updateSection: PropTypes.func.isRequired,
    team: PropTypes.object.isRequired,
    activeSection: PropTypes.string.isRequired
};

export default GeneralTab;

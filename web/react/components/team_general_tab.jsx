// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import SettingItemMin from './setting_item_min.jsx';
import SettingItemMax from './setting_item_max.jsx';

import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';
import TeamStore from '../stores/team_store.jsx';

const messages = defineMessages({
    clientError1: {
        id: 'general_tab.clientError1',
        defaultMessage: 'This field is required'
    },
    clientError2: {
        id: 'general_tab.clientError2',
        defaultMessage: 'Please choose a new name for your team'
    },
    teamName: {
        id: 'general_tab.teamName',
        defaultMessage: 'Team Name'
    },
    close: {
        id: 'general_tab.close',
        defaultMessage: 'Close'
    },
    title: {
        id: 'general_tab.title',
        defaultMessage: 'General Settings'
    },
    dirDisabled: {
        id: 'general_tab.dirDisabled',
        defaultMessage: 'Team directory has been disabled.  Please ask a system admin to enable it.'
    },
    required: {
        id: 'general_tab.required',
        defaultMessage: 'This field is required'
    },
    yes: {
        id: 'general_tab.yes',
        defaultMessage: 'Yes'
    },
    no: {
        id: 'general_tab.no',
        defaultMessage: 'No'
    },
    includeDirDesc: {
        id: 'general_tab.includeDirDesc',
        defaultMessage: 'Including this team will display the team name from the Team Directory section of the Home Page, and provide a link to the sign-in page.'
    },
    includeDirTitle: {
        id: 'general_tab.includeDirTitle',
        defaultMessage: 'Include this team in the Team Directory'
    },
    openInviteDesc: {
        id: 'general_tab.openInviteDesc',
        defaultMessage: 'When allowed, a link to account creation will be included on the sign-in page of this team and allow any visitor to sign-up.'
    },
    openInviteTitle: {
        id: 'general_tab.openInviteTitle',
        defaultMessage: 'Allow anyone to sign-up from login page'
    },
    codeTitle: {
        id: 'general_tab.codeTitle',
        defaultMessage: 'Invite Code'
    },
    regenerate: {
        id: 'general_tab.regenerate',
        defaultMessage: 'Re-Generate'
    },
    codeLongDesc: {
        id: 'general_tab.codeLongDesc',
        defaultMessage: 'Your Invite Code is used in the URL sent to people to join your team. Regenerating your Invite Code will invalidate the URLs in previous invitations, unless "Allow anyone to sign-up from login page" is enabled.'
    },
    codeDesc: {
        id: 'general_tab.codeDesc',
        defaultMessage: "Click 'Edit' to regenerate Invite Code."
    },
    teamNameInfo: {
        id: 'general_tab.teamNameInfo',
        defaultMessage: 'Set the name of the team as it appears on your sign-in screen and at the top of the left-hand sidebar.'
    },
    dirContact: {
        id: 'general_tab.dirContact',
        defaultMessage: 'Contact your system administrator to turn on the team directory on the system home page.'
    },
    dirOff: {
        id: 'general_tab.dirOff',
        defaultMessage: 'Team directory is turned off for this system.'
    }
});

class GeneralTab extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);
        this.handleNameSubmit = this.handleNameSubmit.bind(this);
        this.handleInviteIdSubmit = this.handleInviteIdSubmit.bind(this);
        this.handleOpenInviteSubmit = this.handleOpenInviteSubmit.bind(this);
        this.handleTeamListingSubmit = this.handleTeamListingSubmit.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.onUpdateNameSection = this.onUpdateNameSection.bind(this);
        this.updateName = this.updateName.bind(this);
        this.onUpdateInviteIdSection = this.onUpdateInviteIdSection.bind(this);
        this.updateInviteId = this.updateInviteId.bind(this);
        this.onUpdateOpenInviteSection = this.onUpdateOpenInviteSection.bind(this);
        this.handleOpenInviteRadio = this.handleOpenInviteRadio.bind(this);
        this.onUpdateTeamListingSection = this.onUpdateTeamListingSection.bind(this);
        this.handleTeamListingRadio = this.handleTeamListingRadio.bind(this);
        this.handleGenerateInviteId = this.handleGenerateInviteId.bind(this);

        this.state = this.setupInitialState(props);
    }

    updateSection(section) {
        this.setState(this.setupInitialState(this.props));
        this.props.updateSection(section);
    }

    setupInitialState(props) {
        const team = props.team;

        return {
            name: team.display_name,
            invite_id: team.invite_id,
            allow_open_invite: team.allow_open_invite,
            allow_team_listing: team.allow_team_listing,
            serverError: '',
            clientError: ''
        };
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

    handleTeamListingRadio(listing) {
        const {formatMessage} = this.props.intl;

        if (global.window.mm_config.EnableTeamListing !== 'true' && listing) {
            this.setState({clientError: formatMessage(messages.dirDisabled)});
        } else {
            this.setState({allow_team_listing: listing});
        }
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

    handleTeamListingSubmit(e) {
        e.preventDefault();

        var state = {serverError: '', clientError: ''};

        var data = this.props.team;
        data.allow_team_listing = this.state.allow_team_listing;
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

        const {formatMessage} = this.props.intl;
        var state = {serverError: '', clientError: ''};
        let valid = true;

        const name = this.state.name.trim();
        if (!name) {
            state.clientError = formatMessage(messages.clientError1);
            valid = false;
        } else if (name === this.props.team.display_name) {
            state.clientError = formatMessage(messages.clientError2);
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

        const {formatMessage} = this.props.intl;

        var state = {serverError: '', clientError: ''};
        let valid = true;

        const inviteId = this.state.invite_id.trim();
        if (inviteId) {
            state.clientError = '';
        } else {
            state.clientError = formatMessage(messages.required);
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

    componentWillReceiveProps(newProps) {
        if (newProps.team && newProps.teamDisplayName) {
            this.setState({name: newProps.teamDisplayName});
        }
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

    onUpdateTeamListingSection(e) {
        e.preventDefault();
        if (this.props.activeSection === 'team_listing') {
            this.updateSection('');
        } else {
            this.updateSection('team_listing');
        }
    }

    updateName(e) {
        e.preventDefault();
        this.setState({name: e.target.value});
    }

    updateInviteId(e) {
        e.preventDefault();
        this.setState({invite_id: e.target.value});
    }

    render() {
        const {formatMessage} = this.props.intl;
        let clientError = null;
        let serverError = null;
        if (this.state.clientError) {
            clientError = this.state.clientError;
        }
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        const enableTeamListing = global.window.mm_config.EnableTeamListing === 'true';

        let teamListingSection;
        if (this.props.activeSection === 'team_listing') {
            const inputs = [];
            let submitHandle = null;

            if (enableTeamListing) {
                submitHandle = this.handleTeamListingSubmit;

                inputs.push(
                    <div key='userTeamListingOptions'>
                        <div className='radio'>
                            <label>
                                <input
                                    name='userTeamListingOptions'
                                    type='radio'
                                    defaultChecked={this.state.allow_team_listing}
                                    onChange={this.handleTeamListingRadio.bind(this, true)}
                                />
                                {formatMessage(messages.yes)}
                            </label>
                            <br/>
                        </div>
                        <div className='radio'>
                            <label>
                                <input
                                    ref='teamListingRadioNo'
                                    name='userTeamListingOptions'
                                    type='radio'
                                    defaultChecked={!this.state.allow_team_listing}
                                    onChange={this.handleTeamListingRadio.bind(this, false)}
                                />
                                {formatMessage(messages.no)}
                            </label>
                            <br/>
                        </div>
                        <div><br/>{formatMessage(messages.includeDirDesc)}</div>
                    </div>
                );
            } else {
                inputs.push(
                    <div key='userTeamListingOptions'>
                        <div><br/>{formatMessage(messages.dirContact)}</div>
                    </div>
                );
            }

            teamListingSection = (
                <SettingItemMax
                    title={formatMessage(messages.includeDirTitle)}
                    inputs={inputs}
                    submit={submitHandle}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={this.onUpdateTeamListingSection}
                />
            );
        } else {
            let describe = '';

            if (enableTeamListing) {
                if (this.state.allow_team_listing === true) {
                    describe = formatMessage(messages.yes);
                } else {
                    describe = formatMessage(messages.no);
                }
            } else {
                describe = formatMessage(messages.dirOff);
            }

            teamListingSection = (
                <SettingItemMin
                    title={formatMessage(messages.includeDirTitle)}
                    describe={describe}
                    updateSection={this.onUpdateTeamListingSection}
                />
            );
        }

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
                            {formatMessage(messages.yes)}
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
                            {formatMessage(messages.no)}
                        </label>
                        <br/>
                    </div>
                    <div><br/>{formatMessage(messages.openInviteDesc)}</div>
                </div>
            ];

            openInviteSection = (
                <SettingItemMax
                    title={formatMessage(messages.openInviteTitle)}
                    inputs={inputs}
                    submit={this.handleOpenInviteSubmit}
                    server_error={serverError}
                    updateSection={this.onUpdateOpenInviteSection}
                />
            );
        } else {
            let describe = '';
            if (this.state.allow_open_invite === true) {
                describe = formatMessage(messages.yes);
            } else {
                describe = formatMessage(messages.no);
            }

            openInviteSection = (
                <SettingItemMin
                    title={formatMessage(messages.openInviteTitle)}
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
                        <label className='col-sm-5 control-label'>{formatMessage(messages.codeTitle)}</label>
                        <div className='col-sm-7'>
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
                                    {formatMessage(messages.regenerate)}
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className='setting-list__hint'>{formatMessage(messages.codeLongDesc)}</div>
                </div>
            );

            inviteSection = (
                <SettingItemMax
                    title={formatMessage(messages.codeTitle)}
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
                    title={formatMessage(messages.codeTitle)}
                    describe={formatMessage(messages.codeDesc)}
                    updateSection={this.onUpdateInviteIdSection}
                />
            );
        }

        let nameSection;

        if (this.props.activeSection === 'name') {
            const inputs = [];

            let teamNameLabel = formatMessage(messages.teamName);
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

            nameSection = (
                <SettingItemMax
                    title={formatMessage(messages.teamName)}
                    inputs={inputs}
                    submit={this.handleNameSubmit}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={this.onUpdateNameSection}
                    extraInfo={formatMessage(messages.teamNameInfo)}
                />
            );
        } else {
            var describe = this.state.name;

            nameSection = (
                <SettingItemMin
                    title={formatMessage(messages.teamName)}
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
                        aria-label={formatMessage(messages.close)}
                    >
                        <span aria-hidden='true'>&times;</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>
                        {formatMessage(messages.title)}
                    </h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
                    <h3 className='tab-header'>{formatMessage(messages.title)}</h3>
                    <div className='divider-dark first'/>
                    {nameSection}
                    <div className='divider-light'/>
                    {openInviteSection}
                    <div className='divider-light'/>
                    {teamListingSection}
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
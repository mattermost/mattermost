// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

const messages = defineMessages({
    true: {
        id: 'admin.team.true',
        defaultMessage: 'true'
    },
    false: {
        id: 'admin.team.false',
        defaultMessage: 'false'
    },
    title: {
        id: 'admin.team.title',
        defaultMessage: 'Team Settings'
    },
    siteNameTitle: {
        id: 'admin.team.siteNameTitle',
        defaultMessage: 'Site Name:'
    },
    siteNameExample: {
        id: 'admin.team.siteNameExample',
        defaultMessage: 'Ex "Mattermost"'
    },
    siteNameDescription: {
        id: 'admin.team.siteNameDescription',
        defaultMessage: 'Name of service shown in login screens and UI.'
    },
    maxUsersTitle: {
        id: 'admin.team.maxUsersTitle',
        defaultMessage: 'Max Users Per Team:'
    },
    maxUsersExample: {
        id: 'admin.team.maxUsersExample',
        defaultMessage: 'Ex "25"'
    },
    maxUsersDescription: {
        id: 'admin.team.maxUsersDescription',
        defaultMessage: 'Maximum total number of users per team, including both active and inactive users.'
    },
    teamCreationTitle: {
        id: 'admin.team.teamCreationTitle',
        defaultMessage: 'Enable Team Creation: '
    },
    teamCreationDescription: {
        id: 'admin.team.teamCreationDescription',
        defaultMessage: 'When false, the ability to create teams is disabled. The create team button displays error when pressed.'
    },
    userCreationTitle: {
        id: 'admin.team.userCreationTitle',
        defaultMessage: 'Enable User Creation: '
    },
    userCreationDescription: {
        id: 'admin.team.userCreationDescription',
        defaultMessage: 'When false, the ability to create accounts is disabled. The create account button displays error when pressed.'
    },
    restrictTitle: {
        id: 'admin.team.restrictTitle',
        defaultMessage: 'Restrict Creation To Domains:'
    },
    restrictExample: {
        id: 'admin.team.restrictExample',
        defaultMessage: 'Ex "corp.mattermost.com, mattermost.org"'
    },
    restrictDescription: {
        id: 'admin.team.restrictDescription',
        defaultMessage: 'Teams and user accounts can only be created from a specific domain (e.g. "mattermost.org") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.org").'
    },
    saving: {
        id: 'admin.team.saving',
        defaultMessage: 'Saving Config...'
    },
    save: {
        id: 'admin.team.save',
        defaultMessage: 'Save'
    },
    restrictNameTitle: {
        id: 'admin.team.restrictNameTitle',
        defaultMessage: 'Restrict Team Names: '
    },
    restrictNameDesc: {
        id: 'admin.team.restrictNameDesc',
        defaultMessage: 'When true, You cannot create a team name with reserved words like www, admin, support, test, channel, etc'
    },
    dirTitle: {
        id: 'admin.team.dirTitle',
        defaultMessage: 'Enable Team Directory: '
    },
    dirDesc: {
        id: 'admin.team.dirDesc',
        defaultMessage: 'When true, teams that are configured to show in team directory will show on main page inplace of creating a new team.'
    }
});

class TeamSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            saveNeeded: false,
            serverError: null
        };
    }

    handleChange() {
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.TeamSettings.SiteName = ReactDOM.findDOMNode(this.refs.SiteName).value.trim();
        config.TeamSettings.RestrictCreationToDomains = ReactDOM.findDOMNode(this.refs.RestrictCreationToDomains).value.trim();
        config.TeamSettings.EnableTeamCreation = ReactDOM.findDOMNode(this.refs.EnableTeamCreation).checked;
        config.TeamSettings.EnableUserCreation = ReactDOM.findDOMNode(this.refs.EnableUserCreation).checked;
        config.TeamSettings.RestrictTeamNames = ReactDOM.findDOMNode(this.refs.RestrictTeamNames).checked;
        config.TeamSettings.EnableTeamListing = ReactDOM.findDOMNode(this.refs.EnableTeamListing).checked;

        var MaxUsersPerTeam = 50;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.MaxUsersPerTeam).value, 10))) {
            MaxUsersPerTeam = parseInt(ReactDOM.findDOMNode(this.refs.MaxUsersPerTeam).value, 10);
        }
        config.TeamSettings.MaxUsersPerTeam = MaxUsersPerTeam;
        ReactDOM.findDOMNode(this.refs.MaxUsersPerTeam).value = MaxUsersPerTeam;

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig();
                this.setState({
                    serverError: null,
                    saveNeeded: false
                });
                $('#save-button').button('reset');
            },
            (err) => {
                this.setState({
                    serverError: err.message,
                    saveNeeded: true
                });
                $('#save-button').button('reset');
            }
        );
    }

    render() {
        const {formatMessage} = this.props.intl;
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass = 'btn btn-primary';
        }

        return (
            <div className='wrapper--fixed'>

                <h3>{formatMessage(messages.title)}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SiteName'
                        >
                            {formatMessage(messages.siteNameTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SiteName'
                                ref='SiteName'
                                placeholder={formatMessage(messages.siteNameExample)}
                                defaultValue={this.props.config.TeamSettings.SiteName}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.siteNameDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaxUsersPerTeam'
                        >
                            {formatMessage(messages.maxUsersTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaxUsersPerTeam'
                                ref='MaxUsersPerTeam'
                                placeholder={formatMessage(messages.maxUsersExample)}
                                defaultValue={this.props.config.TeamSettings.MaxUsersPerTeam}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.maxUsersDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableTeamCreation'
                        >
                            {formatMessage(messages.teamCreationTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTeamCreation'
                                    value='true'
                                    ref='EnableTeamCreation'
                                    defaultChecked={this.props.config.TeamSettings.EnableTeamCreation}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTeamCreation'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.EnableTeamCreation}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.teamCreationDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableUserCreation'
                        >
                            {formatMessage(messages.userCreationTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableUserCreation'
                                    value='true'
                                    ref='EnableUserCreation'
                                    defaultChecked={this.props.config.TeamSettings.EnableUserCreation}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableUserCreation'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.EnableUserCreation}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.userCreationDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='RestrictCreationToDomains'
                        >
                            {formatMessage(messages.restrictTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='RestrictCreationToDomains'
                                ref='RestrictCreationToDomains'
                                placeholder={formatMessage(messages.restrictExample)}
                                defaultValue={this.props.config.TeamSettings.RestrictCreationToDomains}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.restrictDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='RestrictTeamNames'
                        >
                            {formatMessage(messages.restrictNameTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='RestrictTeamNames'
                                    value='true'
                                    ref='RestrictTeamNames'
                                    defaultChecked={this.props.config.TeamSettings.RestrictTeamNames}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='RestrictTeamNames'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.RestrictTeamNames}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.restrictNameDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableTeamListing'
                        >
                            {formatMessage(messages.dirTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTeamListing'
                                    value='true'
                                    ref='EnableTeamListing'
                                    defaultChecked={this.props.config.TeamSettings.EnableTeamListing}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTeamListing'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.EnableTeamListing}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.dirDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            {serverError}
                            <button
                                disabled={!this.state.saveNeeded}
                                type='submit'
                                className={saveClass}
                                onClick={this.handleSubmit}
                                id='save-button'
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(messages.saving)}
                            >
                                {formatMessage(messages.save)}
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        );
    }
}

TeamSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(TeamSettings);
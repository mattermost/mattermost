// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

export default class TeamSettings extends React.Component {
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
        config.TeamSettings.SiteName = React.findDOMNode(this.refs.SiteName).value.trim();
        config.TeamSettings.RestrictCreationToDomains = React.findDOMNode(this.refs.RestrictCreationToDomains).value.trim();
        config.TeamSettings.EnableTeamCreation = React.findDOMNode(this.refs.EnableTeamCreation).checked;
        config.TeamSettings.EnableUserCreation = React.findDOMNode(this.refs.EnableUserCreation).checked;

        var MaxUsersPerTeam = 50;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.MaxUsersPerTeam).value, 10))) {
            MaxUsersPerTeam = parseInt(React.findDOMNode(this.refs.MaxUsersPerTeam).value, 10);
        }
        config.TeamSettings.MaxUsersPerTeam = MaxUsersPerTeam;
        React.findDOMNode(this.refs.MaxUsersPerTeam).value = MaxUsersPerTeam;

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

                <h3>{'Team Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SiteName'
                        >
                            {'Site Name:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SiteName'
                                ref='SiteName'
                                placeholder='Ex "Mattermost"'
                                defaultValue={this.props.config.TeamSettings.SiteName}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Name of service shown in login screens and UI.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaxUsersPerTeam'
                        >
                            {'Max Users Per Team:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaxUsersPerTeam'
                                ref='MaxUsersPerTeam'
                                placeholder='Ex "25"'
                                defaultValue={this.props.config.TeamSettings.MaxUsersPerTeam}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Maximum total number of users per team, including both active and inactive users.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableTeamCreation'
                        >
                            {'Enable Team Creation: '}
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
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTeamCreation'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.EnableTeamCreation}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When false, the ability to create teams is disabled. The create team button displays error when pressed.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableUserCreation'
                        >
                            {'Enable User Creation: '}
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
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableUserCreation'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.EnableUserCreation}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When false, the ability to create accounts is disabled. The create account button displays error when pressed.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='RestrictCreationToDomains'
                        >
                            {'Restrict Creation To Domains:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='RestrictCreationToDomains'
                                ref='RestrictCreationToDomains'
                                placeholder='Ex "corp.mattermost.com, mattermost.org"'
                                defaultValue={this.props.config.TeamSettings.RestrictCreationToDomains}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Teams can only be created from a specific domain (e.g. "mattermost.org") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.org").'}</p>
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> Saving Config...'}
                            >
                                {'Save'}
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        );
    }
}

TeamSettings.propTypes = {
    config: React.PropTypes.object
};

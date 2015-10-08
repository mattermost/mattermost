// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

export default class PrivacySettings extends React.Component {
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
        config.PrivacySettings.ShowEmailAddress = React.findDOMNode(this.refs.ShowEmailAddress).checked;
        config.PrivacySettings.ShowFullName = React.findDOMNode(this.refs.ShowFullName).checked;
        config.PrivacySettings.EnableSecurityFixAlert = React.findDOMNode(this.refs.EnableSecurityFixAlert).checked;

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
                <h3>{'Privacy Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ShowEmailAddress'
                        >
                            {'Show Email Address: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='ShowEmailAddress'
                                    value='true'
                                    ref='ShowEmailAddress'
                                    defaultChecked={this.props.config.PrivacySettings.ShowEmailAddress}
                                    onChange={this.handleChange}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='ShowEmailAddress'
                                    value='false'
                                    defaultChecked={!this.props.config.PrivacySettings.ShowEmailAddress}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When false, hides email address of users from other users in the user interface, including team owners and team administrators. Used when system is set up for managing teams where some users choose to keep their contact information private.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ShowFullName'
                        >
                            {'Show Full Name: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='ShowFullName'
                                    value='true'
                                    ref='ShowFullName'
                                    defaultChecked={this.props.config.PrivacySettings.ShowFullName}
                                    onChange={this.handleChange}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='ShowFullName'
                                    value='false'
                                    defaultChecked={!this.props.config.PrivacySettings.ShowFullName}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When false, hides full name of users from other users including team owner and team administrators.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableSecurityFixAlert'
                        >
                            {'Send Error and Diagnostic: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableSecurityFixAlert'
                                    value='true'
                                    ref='EnableSecurityFixAlert'
                                    defaultChecked={this.props.config.PrivacySettings.EnableSecurityFixAlert}
                                    onChange={this.handleChange}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableSecurityFixAlert'
                                    value='false'
                                    defaultChecked={!this.props.config.PrivacySettings.EnableSecurityFixAlert}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When true, System Administrators are notified by email if a relevant security fix alert has been announced in the last 12 hours. Requires email to be enabled.'}</p>
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

PrivacySettings.propTypes = {
    config: React.PropTypes.object
};

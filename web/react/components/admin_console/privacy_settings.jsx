// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

const messages = defineMessages({
    true: {
        id: 'admin.privacy.true',
        defaultMessage: 'true'
    },
    false: {
        id: 'admin.privacy.false',
        defaultMessage: 'false'
    },
    title: {
        id: 'admin.privacy.title',
        defaultMessage: 'Privacy Settings'
    },
    showEmailTitle: {
        id: 'admin.privacy.showEmailTitle',
        defaultMessage: 'Show Email Address: '
    },
    showEmailDescription: {
        id: 'admin.privacy.showEmailDescription',
        defaultMessage: 'When false, hides email address of users from other users in the user interface, including team owners and team administrators. Used when system is set up for managing teams where some users choose to keep their contact information private.'
    },
    showFullNameTitle: {
        id: 'admin.privacy.showFullNameTitle',
        defaultMessage: 'Show Full Name: '
    },
    showFullNameDescription: {
        id: 'admin.privacy.showFullNameDescription',
        defaultMessage: 'When false, hides full name of users from other users, including team owners and team administrators. Username is shown in place of full name.'
    },
    diagnosticTitle: {
        id: 'admin.privacy.diagnosticTitle',
        defaultMessage: 'Send Error and Diagnostic: '
    },
    diagnosticDescription: {
        id: 'admin.privacy.diagnosticDescription',
        defaultMessage: 'When true, The server will periodically send error and diagnostic information to Mattermost.'
    },
    saving: {
        id: 'admin.privacy.saving',
        defaultMessage: 'Saving Config...'
    },
    save: {
        id: 'admin.privacy.save',
        defaultMessage: 'Save'
    }
});

class PrivacySettings extends React.Component {
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
        config.PrivacySettings.ShowEmailAddress = ReactDOM.findDOMNode(this.refs.ShowEmailAddress).checked;
        config.PrivacySettings.ShowFullName = ReactDOM.findDOMNode(this.refs.ShowFullName).checked;

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
                            htmlFor='ShowEmailAddress'
                        >
                            {formatMessage(messages.showEmailTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='ShowEmailAddress'
                                    value='false'
                                    defaultChecked={!this.props.config.PrivacySettings.ShowEmailAddress}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.showEmailDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ShowFullName'
                        >
                            {formatMessage(messages.showFullNameTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='ShowFullName'
                                    value='false'
                                    defaultChecked={!this.props.config.PrivacySettings.ShowFullName}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.showFullNameDescription)}</p>
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

PrivacySettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(PrivacySettings);
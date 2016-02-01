// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    saving: {
        id: 'admin.privacy.saving',
        defaultMessage: 'Saving Config...'
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
                <h3>
                    <FormattedMessage
                        id='admin.privacy.title'
                        defaultMessage='Privacy Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ShowEmailAddress'
                        >
                            <FormattedMessage
                                id='admin.privacy.showEmailTitle'
                                defaultMessage='Show Email Address: '
                            />
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
                                    <FormattedMessage
                                        id='admin.privacy.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='ShowEmailAddress'
                                    value='false'
                                    defaultChecked={!this.props.config.PrivacySettings.ShowEmailAddress}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.privacy.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.privacy.showEmailDescription'
                                    defaultMessage='When false, hides email address of users from other users in the user interface, including team owners and team administrators. Used when system is set up for managing teams where some users choose to keep their contact information private.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ShowFullName'
                        >
                            <FormattedMessage
                                id='admin.privacy.showFullNameTitle'
                                defaultMessage='Show Full Name: '
                            />
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
                                    <FormattedMessage
                                        id='admin.privacy.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='ShowFullName'
                                    value='false'
                                    defaultChecked={!this.props.config.PrivacySettings.ShowFullName}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.privacy.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.privacy.showFullNameDescription'
                                    defaultMessage='When false, hides full name of users from other users, including team owners and team administrators. Username is shown in place of full name.'
                                />
                            </p>
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + this.props.intl.formatMessage(holders.saving)}
                            >
                                <FormattedMessage
                                    id='admin.privacy.save'
                                    defaultMessage='Save'
                                />
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
// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

const messages = defineMessages({
    title: {
        id: 'admin.support.title',
        defaultMessage: 'Legal and Support Settings'
    },
    termsTitle: {
        id: 'admin.support.termsTitle',
        defaultMessage: 'Terms of Service link:'
    },
    termsDesc: {
        id: 'admin.support.termsDesc',
        defaultMessage: 'Link to Terms of Service available to users on desktop and on mobile. Leaving this blank will hide the option to display a notice.'
    },
    privacyTitle: {
        id: 'admin.support.privacyTitle',
        defaultMessage: 'Privacy Policy link:'
    },
    privacyDesc: {
        id: 'admin.support.privacyDesc',
        defaultMessage: 'Link to Privacy Policy available to users on desktop and on mobile. Leaving this blank will hide the option to display a notice.'
    },
    aboutTitle: {
        id: 'admin.support.aboutTitle',
        defaultMessage: 'About link:'
    },
    aboutDesc: {
        id: 'admin.support.aboutDesc',
        defaultMessage: 'Link to About page for more information on your Mattermost deployment, for example its purpose and audience within your organization. Defaults to Mattermost information page.'
    },
    helpTitle: {
        id: 'admin.support.helpTitle',
        defaultMessage: 'Help link:'
    },
    helpDesc: {
        id: 'admin.support.helpDesc',
        defaultMessage: 'Link to help documentation from team site main menu. Typically not changed unless your organization chooses to create custom documentation.'
    },
    problemTitle: {
        id: 'admin.support.problemTitle',
        defaultMessage: 'Report a Problem link:'
    },
    problemDesc: {
        id: 'admin.support.problemDesc',
        defaultMessage: 'Link to help documentation from team site main menu. By default this points to the peer-to-peer troubleshooting forum where users can search for, find and request help with technical issues.'
    },
    emailTitle: {
        id: 'admin.support.emailTitle',
        defaultMessage: 'Support email:'
    },
    emailDesc: {
        id: 'admin.support.emailHelp',
        defaultMessage: 'Email shown during tutorial for end users to ask support questions.'
    },
    saving: {
        id: 'admin.support.saving',
        defaultMessage: 'Saving Config...'
    },
    save: {
        id: 'admin.support.save',
        defaultMessage: 'Save'
    }
});

class LegalAndSupportSettings extends React.Component {
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

        config.SupportSettings.TermsOfServiceLink = ReactDOM.findDOMNode(this.refs.TermsOfServiceLink).value.trim();
        config.SupportSettings.PrivacyPolicyLink = ReactDOM.findDOMNode(this.refs.PrivacyPolicyLink).value.trim();
        config.SupportSettings.AboutLink = ReactDOM.findDOMNode(this.refs.AboutLink).value.trim();
        config.SupportSettings.HelpLink = ReactDOM.findDOMNode(this.refs.HelpLink).value.trim();
        config.SupportSettings.ReportAProblemLink = ReactDOM.findDOMNode(this.refs.ReportAProblemLink).value.trim();
        config.SupportSettings.SupportEmail = ReactDOM.findDOMNode(this.refs.SupportEmail).value.trim();

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
                            htmlFor='TermsOfServiceLink'
                        >
                            {formatMessage(messages.termsTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='TermsOfServiceLink'
                                ref='TermsOfServiceLink'
                                defaultValue={this.props.config.SupportSettings.TermsOfServiceLink}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.termsDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PrivacyPolicyLink'
                        >
                            {formatMessage(messages.privacyTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PrivacyPolicyLink'
                                ref='PrivacyPolicyLink'
                                defaultValue={this.props.config.SupportSettings.PrivacyPolicyLink}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.privacyDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AboutLink'
                        >
                            {formatMessage(messages.aboutTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AboutLink'
                                ref='AboutLink'
                                defaultValue={this.props.config.SupportSettings.AboutLink}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.aboutDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='HelpLink'
                        >
                            {formatMessage(messages.helpTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='HelpLink'
                                ref='HelpLink'
                                defaultValue={this.props.config.SupportSettings.HelpLink}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.helpDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ReportAProblemLink'
                        >
                            {formatMessage(messages.problemTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ReportAProblemLink'
                                ref='ReportAProblemLink'
                                defaultValue={this.props.config.SupportSettings.ReportAProblemLink}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.problemDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SupportEmail'
                        >
                            {formatMessage(messages.emailTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SupportEmail'
                                ref='SupportEmail'
                                defaultValue={this.props.config.SupportSettings.SupportEmail}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.emailDesc)}</p>
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
                                data-loading-text={`<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> $formatMessage(messages.saving)`}
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

LegalAndSupportSettings.propTypes = {
    config: React.PropTypes.object,
    intl: intlShape.isRequired
};

export default injectIntl(LegalAndSupportSettings);
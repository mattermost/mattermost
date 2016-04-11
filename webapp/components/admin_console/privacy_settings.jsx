// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export class PrivacySettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            showEmailAddress: props.config.PrivacySettings.ShowEmailAddress,
            showFullName: props.config.PrivacySettings.ShowFullName
        });
    }

    getConfigFromState(config) {
        config.PrivacySettings.ShowEmailAddress = this.state.showEmailAddress;
        config.PrivacySettings.ShowFullName = this.state.showFullName;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.general.title'
                    defaultMessage='General Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <PrivacySettings
                showEmailAddress={this.state.showEmailAddress}
                showFullName={this.state.showFullName}
                onChange={this.handleChange}
            />
        );
    }
}

export class PrivacySettings extends React.Component {
    static get propTypes() {
        return {
            showEmailAddress: React.PropTypes.bool.isRequired,
            showFullName: React.PropTypes.bool.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.general.privacy'
                        defaultMessage='Privacy'
                    />
<<<<<<< HEAD
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
=======
                }
            >
                <BooleanSetting
                    id='showEmailAddress'
                    label={
                        <FormattedMessage
                            id='admin.privacy.showEmailTitle'
                            defaultMessage='Show Email Address: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.privacy.showEmailDescription'
                            defaultMessage='When false, hides email address of users from other users in the user interface, including team owners and team administrators. Used when system is set up for managing teams where some users choose to keep their contact information private.'
                        />
                    }
                    value={this.props.showEmailAddress}
                    onChange={this.props.onChange}
                />
                <BooleanSetting
                    id='showFullName'
                    label={
                        <FormattedMessage
                            id='admin.privacy.showFullNameTitle'
                            defaultMessage='Show Full Name: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.privacy.showFullNameDescription'
                            defaultMessage='When false, hides full name of users from other users, including team owners and team administrators. Username is shown in place of full name.'
                        />
                    }
                    value={this.props.showFullName}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}
>>>>>>> 6d02983... Reorganized system console

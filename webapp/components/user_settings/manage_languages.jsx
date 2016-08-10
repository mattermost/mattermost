// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMax from '../setting_item_max.jsx';

import Client from 'client/web_client.jsx';
import * as I18n from 'i18n/i18n.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import React from 'react';

export default class ManageLanguage extends React.Component {
    constructor(props) {
        super(props);

        this.setupInitialState = this.setupInitialState.bind(this);
        this.setLanguage = this.setLanguage.bind(this);
        this.changeLanguage = this.changeLanguage.bind(this);
        this.submitUser = this.submitUser.bind(this);
        this.state = this.setupInitialState(props);
    }
    setupInitialState(props) {
        var user = props.user;
        return {
            locale: user.locale
        };
    }
    setLanguage(e) {
        this.setState({locale: e.target.value});
    }
    changeLanguage(e) {
        e.preventDefault();

        var user = this.props.user;
        var locale = this.state.locale;

        user.locale = locale;

        this.submitUser(user);
    }
    submitUser(user) {
        Client.updateUser(user, Constants.UserUpdateEvents.LANGUAGE,
            () => {
                GlobalActions.newLocalizationSelected(user.locale);
            },
            (err) => {
                let serverError;
                if (err.message) {
                    serverError = err.message;
                } else {
                    serverError = err;
                }
                this.setState({serverError});
            }
        );
    }
    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = <label className='has-error'>{this.state.serverError}</label>;
        }

        const options = [];
        const languages = I18n.getLanguages();
        for (const key in languages) {
            if (languages.hasOwnProperty(key)) {
                const lang = languages[key];
                options.push(
                    <option
                        key={lang.value}
                        value={lang.value}
                    >
                        {lang.name}
                    </option>
                );
            }
        }

        const input = (
            <div key='changeLanguage'>
                <br/>
                <label className='control-label'>
                    <FormattedMessage
                        id='user.settings.languages.change'
                        defaultMessage='Change interface language'
                    />
                </label>
                <div className='padding-top'>
                    <select
                        ref='language'
                        className='form-control'
                        value={this.state.locale}
                        onChange={this.setLanguage}
                    >
                        {options}
                    </select>
                    {serverError}
                </div>
                <div>
                    <br/>
                    <FormattedHTMLMessage
                        id='user.settings.languages.promote'
                        defaultMessage='Select which language Mattermost displays in the user interface.<br /><br />Would like to help with translations? Join the <a href="http://translate.mattermost.com/" target="_blank">Mattermost Translation Server</a> to contribute.'
                    />
                </div>
            </div>
        );

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.display.language'
                        defaultMessage='Language'
                    />
                }
                width='medium'
                submit={this.changeLanguage}
                inputs={[input]}
                updateSection={this.props.updateSection}
            />
        );
    }
}

ManageLanguage.propTypes = {
    user: React.PropTypes.object.isRequired,
    updateSection: React.PropTypes.func.isRequired
};

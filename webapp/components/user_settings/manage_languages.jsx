// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMax from '../setting_item_max.jsx';

import * as I18n from 'i18n/i18n.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import {updateUser} from 'actions/user_actions.jsx';
import PropTypes from 'prop-types';
import React from 'react';

export default class ManageLanguage extends React.Component {
    constructor(props) {
        super(props);

        this.setLanguage = this.setLanguage.bind(this);
        this.changeLanguage = this.changeLanguage.bind(this);
        this.submitUser = this.submitUser.bind(this);
        this.state = {
            locale: props.locale
        };
    }

    setLanguage(e) {
        this.setState({locale: e.target.value});
    }
    changeLanguage(e) {
        e.preventDefault();

        this.submitUser({
            ...this.props.user,
            locale: this.state.locale
        });
    }
    submitUser(user) {
        updateUser(user, Constants.UserUpdateEvents.LANGUAGE,
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
        const locales = I18n.getLanguages();

        const languages = Object.keys(locales).map((l) => {
            return {
                value: locales[l].value,
                name: locales[l].name,
                order: locales[l].order
            };
        }).
        sort((a, b) => a.order - b.order);

        languages.forEach((lang) => {
            options.push(
                <option
                    key={lang.value}
                    value={lang.value}
                >
                    {lang.name}
                </option>
            );
        });

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
                        id='displayLanguage'
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
    user: PropTypes.object.isRequired,
    locale: PropTypes.string.isRequired,
    updateSection: PropTypes.func.isRequired
};
